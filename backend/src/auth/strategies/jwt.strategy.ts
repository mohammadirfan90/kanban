import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  email: string;
  /** Session this token was minted for — see SessionService. */
  sid?: string;
  /**
   * Marks an access token. Refresh tokens are opaque random strings, never
   * JWTs, so this is really a guard against some future second token type
   * being accepted here by accident.
   */
  type?: 'access';
  iat?: number;
  exp?: number;
}

// Cookie names — kept in one place so the controller and strategy agree.
export const AUTH_COOKIE = 'kanban_token';
export const REFRESH_COOKIE = 'kanban_refresh';

/**
 * Extract the access token from either:
 *   1. The `kanban_token` httpOnly cookie (preferred — unreadable from JS)
 *   2. The `Authorization: Bearer …` header (kept for curl, API consumers, tests)
 */
const tokenExtractor = (req: Request): string | null => {
  const fromCookie = (req as Request & { cookies?: Record<string, string> })?.cookies?.[
    AUTH_COOKIE
  ];
  if (fromCookie) return fromCookie;
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not set in the environment');
    }
    super({
      jwtFromRequest: tokenExtractor,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /*
    Deliberately NOT checked here: whether the session behind `sid` is still
    live.

    Access tokens are short (JWT_EXPIRES_IN, 15m by default) and stateless, so
    the hot path stays a signature check with no database round trip — which is
    what lets the API scale horizontally without a shared session store. The
    cost is a bounded window: revoking a session stops refresh immediately, but
    an access token already in flight remains valid until it expires.

    /auth/me does verify the session, so a revoked device notices on its next
    page load rather than up to 15 minutes later.
  */
  validate(payload: JwtPayload): JwtPayload {
    if (payload.type && payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    return payload;
  }
}
