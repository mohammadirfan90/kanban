import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionService, type SessionContext, type SessionView } from './session.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AUTH_COOKIE, REFRESH_COOKIE } from './strategies/jwt.strategy';
import type { JwtPayload } from './strategies/jwt.strategy';

/*
  5 attempts/min/IP on the credential endpoints. Overrides BOTH global tiers,
  which is how @nestjs/throttler scopes a limit to a route — naming a tier in
  ThrottlerModule.forRoot applies it everywhere, and @Throttle changes its
  numbers for the decorated route rather than opting in.
*/
const AUTH_LIMIT = {
  short: { limit: 5, ttl: 60_000 },
  default: { limit: 5, ttl: 60_000 },
} as const;

/*
  Refresh is hit by every tab on load and whenever an access token ages out, so
  it gets a looser ceiling than login — but still a ceiling, because replaying a
  captured refresh cookie is exactly what rotation is meant to catch.
*/
const REFRESH_LIMIT = {
  short: { limit: 10, ttl: 60_000 },
  default: { limit: 60, ttl: 60_000 },
} as const;

const ACCESS_COOKIE_MAX_AGE_MS = 60 * 60 * 1000; // upper bound; the JWT exp governs
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Scope of the refresh cookie.
 *
 * `/api/auth` rather than `/`, so the long-lived credential is only ever sent
 * to the endpoints that need it — it is absent from every board and task
 * request, and a bug elsewhere in the API cannot see it.
 */
const REFRESH_COOKIE_PATH = '/api/auth';

/*
  Cookie attributes, derived per request and shared by set and clear so the
  browser can match them on removal.

  The deployed frontend (Vercel) and this API (Render) are different
  registrable domains, so every authenticated call is cross-site — and a
  SameSite=Lax cookie is never attached to one of those. Cross-site requires
  SameSite=None, which browsers only honour together with Secure.

  This keys off the actual protocol rather than NODE_ENV on purpose: the
  README main path is `docker compose up`, which runs this image with
  NODE_ENV=production but serves plain http on localhost. Keying off the
  environment would send SameSite=None without a usable Secure context and
  break local sign-in. Over http we are same-site anyway, so Lax is correct.
*/
function cookieOptions(req: Request, path = '/'): CookieOptions {
  const isHttps =
    req.secure || (req.headers['x-forwarded-proto'] ?? '').toString().split(',')[0] === 'https';
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    path,
  };
}

function contextOf(req: Request): SessionContext {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(AUTH_LIMIT)
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(dto, contextOf(req));
    this.setAuthCookies(req, res, result.access_token, result.refresh_token);
    return { user: result.user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_LIMIT)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, contextOf(req));
    this.setAuthCookies(req, res, result.access_token, result.refresh_token);
    return { user: result.user };
  }

  /** Exchange the rotating refresh cookie for a fresh access token. */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle(REFRESH_LIMIT)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.refreshCookie(req);
    if (!token) {
      throw new UnauthorizedException('No session');
    }
    try {
      const result = await this.auth.refresh(token, contextOf(req));
      this.setAuthCookies(req, res, result.access_token, result.refresh_token);
      return { user: result.user };
    } catch (e) {
      // A dead session should not leave its cookies behind to be retried.
      this.clearAuthCookies(req, res);
      throw e;
    }
  }

  /** End this session only. */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.refreshCookie(req);
    if (token) {
      await this.sessions.revokeByToken(token);
    }
    this.clearAuthCookies(req, res);
    return { ok: true };
  }

  /** End every session for this user, on every device. */
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logoutAll(
    @CurrentUser() jwt: JwtPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const revoked = await this.sessions.revokeAllForUser(jwt.sub);
    this.clearAuthCookies(req, res);
    return { ok: true, revoked };
  }

  // /me is hit on every page load, so it carries no @Throttle override and runs
  // under the ordinary global tiers.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() jwt: JwtPayload) {
    // Verified here (and only here) so a device whose session was revoked
    // elsewhere finds out on its next page load, rather than whenever its
    // access token happens to expire.
    if (jwt.sid && !(await this.sessions.isActive(jwt.sid))) {
      throw new UnauthorizedException('Session ended');
    }
    return this.auth.getMe(jwt.sub);
  }

  /** Live sessions for the caller, so they can spot a device they do not know. */
  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  listSessions(@CurrentUser() jwt: JwtPayload): Promise<SessionView[]> {
    return this.sessions.listForUser(jwt.sub, jwt.sid);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async revokeSession(@CurrentUser() jwt: JwtPayload, @Param('id') id: string): Promise<void> {
    // Scoped to the caller in the service, so one user cannot end a session
    // belonging to somebody else.
    const revoked = await this.sessions.revokeById(jwt.sub, id);
    if (!revoked) {
      throw new NotFoundException('Session not found');
    }
  }

  // ── cookie plumbing ───────────────────────────────────────────────────

  private refreshCookie(req: Request): string | undefined {
    return (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE];
  }

  private setAuthCookies(req: Request, res: Response, access: string, refresh: string): void {
    res.cookie(AUTH_COOKIE, access, { ...cookieOptions(req), maxAge: ACCESS_COOKIE_MAX_AGE_MS });
    res.cookie(REFRESH_COOKIE, refresh, {
      ...cookieOptions(req, REFRESH_COOKIE_PATH),
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
  }

  private clearAuthCookies(req: Request, res: Response): void {
    res.clearCookie(AUTH_COOKIE, cookieOptions(req));
    res.clearCookie(REFRESH_COOKIE, cookieOptions(req, REFRESH_COOKIE_PATH));
  }
}
