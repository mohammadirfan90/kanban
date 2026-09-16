import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const PROVIDER = 'google';
const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** The subset of Google's ID token we actually use. */
interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  /** Profile picture URL. Google serves these itself; we only store the URL. */
  picture?: string;
}

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Google sign-in is optional: without credentials the routes report 400. */
  get enabled(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  private get clientId(): string | undefined {
    return this.config.get<string>('GOOGLE_CLIENT_ID');
  }

  private get clientSecret(): string | undefined {
    return this.config.get<string>('GOOGLE_CLIENT_SECRET');
  }

  private get callbackUrl(): string {
    return this.config.get<string>('GOOGLE_CALLBACK_URL', '');
  }

  /**
   * Where to send the browser after a successful sign-in.
   *
   * Always derived from configuration, never from a query parameter. Taking a
   * caller-supplied `returnTo` here is the classic open-redirect in an OAuth
   * callback: an attacker sends someone through a legitimate Google login and
   * lands them on a page of their choosing, with the sign-in looking genuine.
   */
  appUrl(path: string): string {
    const base = (this.config.get<string>('PUBLIC_APP_URL') ?? '').replace(/\/+$/, '');
    return `${base}${path}`;
  }

  /** A random value tying the callback to the request that started it. */
  newState(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Compare the state Google echoed back with the one we set as a cookie.
   *
   * This is the CSRF control for the callback. Without it an attacker can feed
   * a victim their own `code`, and the victim's browser silently ends up signed
   * in to the attacker's account — after which anything the victim writes lands
   * in a board the attacker controls.
   */
  verifyState(fromQuery: string | undefined, fromCookie: string | undefined): void {
    if (!fromQuery || !fromCookie) {
      throw new UnauthorizedException('Invalid sign-in state');
    }
    const a = Buffer.from(fromQuery);
    const b = Buffer.from(fromCookie);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid sign-in state');
    }
  }

  /** The Google consent screen URL to redirect the browser to. */
  authorizeUrl(state: string): string {
    if (!this.enabled) {
      throw new BadRequestException('Google sign-in is not configured');
    }
    const params = new URLSearchParams({
      client_id: this.clientId!,
      redirect_uri: this.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      // We only need identity, so ask for neither offline access nor a refresh
      // token — there is nothing we would legitimately do with one.
      prompt: 'select_account',
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  /**
   * Exchange the authorization code for Google's ID token and read the profile.
   *
   * The ID token's signature is deliberately not verified here. Signature
   * checks exist for tokens that arrive via the browser, where anyone could
   * have minted them. This one comes back on a direct server-to-server TLS
   * connection to accounts.google.com, authenticated with our client secret —
   * Google's own documentation says a token obtained this way can be used
   * without validation. Verifying it would mean fetching and caching JWKS for
   * no additional guarantee.
   */
  private async exchangeCode(code: string): Promise<GoogleProfile> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        redirect_uri: this.callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!res.ok) {
      this.logger.warn(`Google token exchange failed: ${res.status}`);
      throw new UnauthorizedException('Google sign-in failed');
    }

    const body = (await res.json()) as { id_token?: string };
    if (!body.id_token) {
      throw new UnauthorizedException('Google sign-in failed');
    }

    const payload = body.id_token.split('.')[1];
    if (!payload) {
      throw new UnauthorizedException('Google sign-in failed');
    }
    const profile = JSON.parse(Buffer.from(payload, 'base64url').toString()) as GoogleProfile;
    if (!profile.sub || !profile.email) {
      throw new UnauthorizedException('Google sign-in failed');
    }
    return profile;
  }

  /**
   * Resolve a Google profile to one of our users, creating or linking as needed.
   *
   * Three cases, in order:
   *
   *  1. We have seen this Google account before — use the linked user. Matched
   *     on `sub`, not email, so a user who changes their Google address keeps
   *     their account.
   *  2. A local account already exists with this email — link them, but ONLY if
   *     Google says the address is verified. Without that check, anyone able to
   *     create a Google account claiming a victim's unverified address could
   *     take over the victim's boards.
   *  3. Nobody matches — create an account with no password at all.
   */
  async resolveUser(code: string): Promise<GoogleUser> {
    const profile = await this.exchangeCode(code);
    const email = profile.email.toLowerCase();

    const existingIdentity = await this.prisma.authIdentity.findUnique({
      where: { provider_providerAccountId: { provider: PROVIDER, providerAccountId: profile.sub } },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
    if (existingIdentity) {
      // Refresh the picture on every sign-in: Google rotates these URLs, and a
      // stale one renders as a broken image rather than failing loudly.
      if (profile.picture && profile.picture !== existingIdentity.user.avatarUrl) {
        return this.prisma.user.update({
          where: { id: existingIdentity.user.id },
          data: { avatarUrl: profile.picture },
          select: { id: true, email: true, name: true, avatarUrl: true },
        });
      }
      return existingIdentity.user;
    }

    const byEmail = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    if (byEmail) {
      if (!profile.email_verified) {
        this.logger.warn(`Refused to link unverified Google address to ${byEmail.id}`);
        throw new UnauthorizedException(
          'Your Google email is not verified, so it cannot be linked to an existing account',
        );
      }
      await this.prisma.authIdentity.create({
        data: { userId: byEmail.id, provider: PROVIDER, providerAccountId: profile.sub },
      });
      this.logger.log(`Linked Google identity to existing user ${byEmail.id}`);
      // A password account had no picture; adopt Google's now there is one.
      if (profile.picture && !byEmail.avatarUrl) {
        return this.prisma.user.update({
          where: { id: byEmail.id },
          data: { avatarUrl: profile.picture },
          select: { id: true, email: true, name: true, avatarUrl: true },
        });
      }
      return byEmail;
    }

    const created = await this.prisma.user.create({
      data: {
        email,
        name: profile.name ?? profile.given_name ?? email.split('@')[0],
        // No password, by design — this account signs in through Google only.
        passwordHash: null,
        avatarUrl: profile.picture ?? null,
        identities: { create: { provider: PROVIDER, providerAccountId: profile.sub } },
      },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
    this.logger.log(`Created user ${created.id} from Google sign-in`);
    return created;
  }
}
