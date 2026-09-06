import type { Response } from 'supertest';

/** Must match AUTH_COOKIE in src/auth/strategies/jwt.strategy.ts. */
export const AUTH_COOKIE = 'kanban_token';

/** The raw `Set-Cookie` entry for the auth cookie, attributes included. */
export function rawAuthCookie(res: Response): string {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const match = cookies.find((c) => c.startsWith(`${AUTH_COOKIE}=`));
  if (!match) {
    throw new Error(
      `no ${AUTH_COOKIE} cookie on response; Set-Cookie was ${JSON.stringify(header)}`,
    );
  }
  return match;
}

/**
 * Pull the JWT out of the `Set-Cookie` header.
 *
 * /auth/login and /auth/register stopped returning the token in the body —
 * it is delivered as an httpOnly cookie so browser JS can never read it.
 * JwtStrategy still accepts `Authorization: Bearer` for non-browser callers,
 * so these tests read the token once here and keep using bearer headers.
 */
export function tokenFromResponse(res: Response): string {
  const cookie = rawAuthCookie(res);
  return decodeURIComponent(cookie.slice(AUTH_COOKIE.length + 1).split(';')[0]);
}
