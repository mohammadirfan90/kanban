import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Cookie name — kept in one place so the controller and strategy agree.
export const AUTH_COOKIE = 'kanban_token';

/**
 * Extract JWT from either:
 *   1. The `kanban_token` httpOnly cookie (preferred — XSS-safe)
 *   2. The `Authorization: Bearer …` header (kept for backwards compat
 *      with curl, API consumers, and tests)
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

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
