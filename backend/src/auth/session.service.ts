import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Session } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Context captured on each session, so a user can recognise their own devices. */
export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface IssuedSession {
  /** The raw refresh token. Returned once, never stored, never logged. */
  refreshToken: string;
  session: Session;
}

/** What `GET /auth/sessions` exposes. Deliberately excludes `tokenHash`. */
export interface SessionView {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  current: boolean;
}

const REFRESH_TOKEN_BYTES = 32; // 256 bits of CSPRNG output

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly ttlDays: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.ttlDays = Number(config.get<string>('REFRESH_TOKEN_TTL_DAYS', '30'));
  }

  /**
   * SHA-256, not bcrypt.
   *
   * bcrypt's cost exists to slow brute force against low-entropy human
   * passwords. A refresh token is 256 bits of CSPRNG output with no guessable
   * structure, so there is nothing to slow down — and refresh runs on a hot
   * path where a 250ms KDF would be a real tax.
   */
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private newToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  }

  private expiryFromNow(): Date {
    return new Date(Date.now() + this.ttlDays * 24 * 60 * 60 * 1000);
  }

  /** Start a brand-new session family. Called on register and login. */
  async issue(userId: string, ctx: SessionContext = {}): Promise<IssuedSession> {
    const refreshToken = this.newToken();
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.hash(refreshToken),
        // A fresh login starts its own family; rotation keeps this value.
        familyId: randomBytes(16).toString('hex'),
        expiresAt: this.expiryFromNow(),
        userAgent: ctx.userAgent?.slice(0, 500) ?? null,
        ipAddress: ctx.ipAddress ?? null,
      },
    });
    return { refreshToken, session };
  }

  /**
   * Exchange a refresh token for a new one, rotating it.
   *
   * Rotation is what limits the damage from a captured cookie: the stolen token
   * is single-use, so either the victim or the attacker burns it and the other
   * one's next attempt presents a token that is already revoked. That is the
   * signal `replay` below acts on — we cannot tell which party is the attacker,
   * so the safe move is to kill the whole family and force a fresh login.
   */
  async rotate(rawToken: string, ctx: SessionContext = {}): Promise<IssuedSession> {
    const existing = await this.prisma.session.findUnique({
      where: { tokenHash: this.hash(rawToken) },
    });

    if (!existing) {
      throw new UnauthorizedException('Invalid session');
    }

    if (existing.revokedAt) {
      // Someone is presenting a token that was already rotated away.
      this.logger.warn(
        `Refresh replay detected on family ${existing.familyId}; revoking the family`,
      );
      await this.revokeFamily(existing.familyId);
      throw new UnauthorizedException('Invalid session');
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session expired');
    }

    const refreshToken = this.newToken();
    const [, session] = await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      }),
      this.prisma.session.create({
        data: {
          userId: existing.userId,
          tokenHash: this.hash(refreshToken),
          familyId: existing.familyId, // same family: this is the same login
          expiresAt: this.expiryFromNow(),
          userAgent: ctx.userAgent?.slice(0, 500) ?? existing.userAgent,
          ipAddress: ctx.ipAddress ?? existing.ipAddress,
        },
      }),
    ]);

    return { refreshToken, session };
  }

  /** Revoke one session by its refresh token (normal logout). */
  async revokeByToken(rawToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash: this.hash(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoke every live session for a user (logout everywhere). */
  async revokeAllForUser(userId: string): Promise<number> {
    const { count } = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count;
  }

  /** Revoke a single session by id, scoped to its owner so one user cannot end another's. */
  async revokeById(userId: string, sessionId: string): Promise<boolean> {
    const { count } = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count > 0;
  }

  /** Live sessions for a user, newest first, with the caller's own marked. */
  async listForUser(userId: string, currentSessionId?: string): Promise<SessionView[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt ? s.lastUsedAt.toISOString() : null,
      expiresAt: s.expiresAt.toISOString(),
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      current: currentSessionId ? this.sameId(s.id, currentSessionId) : false,
    }));
  }

  /** Is this session still usable? Used by /auth/me so the UI notices a revoke. */
  async isActive(sessionId: string): Promise<boolean> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { revokedAt: true, expiresAt: true },
    });
    return !!session && !session.revokedAt && session.expiresAt.getTime() > Date.now();
  }

  /** Housekeeping: drop rows that can never be used again. */
  async purgeExpired(before = new Date()): Promise<number> {
    const { count } = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: before } },
    });
    return count;
  }

  private sameId(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
