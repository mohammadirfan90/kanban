import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SessionService, type SessionContext } from './session.service';

export const BCRYPT_COST = 12;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthResult {
  /** Short-lived; the controller sets it as the `kanban_token` cookie. */
  access_token: string;
  /** Opaque, long-lived, DB-backed; set as the `kanban_refresh` cookie. */
  refresh_token: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly sessions: SessionService,
  ) {}

  async register(dto: RegisterDto, ctx: SessionContext = {}): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name },
    });

    return this.startSession(user, ctx);
  }

  async login(dto: LoginDto, ctx: SessionContext = {}): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Same error for both branches, and a dummy hash when the user is missing,
    // so neither the message nor the response time reveals whether the address
    // is registered.
    if (!user) {
      await bcrypt.compare(dto.password, '$2b$12$invalidsaltinvalidsaltinvalidsaltinvalidsalti');
      throw new UnauthorizedException('Invalid credentials');
    }

    /*
      A Google-created account has no password at all.

      Still runs the dummy compare and still returns the generic message: a
      distinct "use Google to sign in" error here would tell an attacker which
      addresses are Google accounts, which is exactly the enumeration the rest
      of this method is careful to avoid.
    */
    if (!user.passwordHash) {
      await bcrypt.compare(dto.password, '$2b$12$invalidsaltinvalidsaltinvalidsaltinvalidsalti');
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.startSession(user, ctx);
  }

  /** Rotate a refresh token and mint a matching access token. */
  async refresh(rawRefreshToken: string, ctx: SessionContext = {}): Promise<AuthResult> {
    const { refreshToken, session } = await this.sessions.rotate(rawRefreshToken, ctx);
    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      // The account was deleted while the session lived on.
      await this.sessions.revokeFamily(session.familyId);
      throw new UnauthorizedException('Invalid session');
    }
    return {
      access_token: this.signAccessToken(user, session.id),
      refresh_token: refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  /**
   * Open a session for a user the Google flow already authenticated.
   *
   * Separate from login() on purpose: there is no password to check here, and
   * routing an unauthenticated path through the same method as the credential
   * one is how a "skip the password" bug gets written later. This is only
   * reachable from the OAuth callback, after the state check and the code
   * exchange with Google.
   */
  async startSessionForUser(
    user: { id: string; email: string; name: string },
    ctx: SessionContext = {},
  ): Promise<AuthResult> {
    return this.startSession(user, ctx);
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return { id: user.id, email: user.email, name: user.name };
  }

  private async startSession(
    user: { id: string; email: string; name: string },
    ctx: SessionContext,
  ): Promise<AuthResult> {
    const { refreshToken, session } = await this.sessions.issue(user.id, ctx);
    this.logger.log(`Session ${session.id} opened for ${user.email}`);
    return {
      access_token: this.signAccessToken(user, session.id),
      refresh_token: refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  /*
    The access token carries identity and the session id, and nothing else.

    Board roles deliberately stay out of it: membership changes the moment an
    owner shares or revokes a board, and a role baked into a token would keep
    working until the token expired. The database is the only source of truth
    for authorization — see BoardsService.assertAccess.
  */
  private signAccessToken(user: { id: string; email: string }, sessionId: string): string {
    return this.jwt.sign({ sub: user.id, email: user.email, sid: sessionId, type: 'access' });
  }
}
