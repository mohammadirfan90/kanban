import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AUTH_COOKIE } from './strategies/jwt.strategy';
import type { JwtPayload } from './strategies/jwt.strategy';

// 5 attempts/min/IP — a comfortable ceiling for legitimate users
// (failed login + immediate retry, or two tabs) but tight enough to
// make online credential stuffing infeasible. bcrypt cost-12 already
// slows each attempt to ~250ms; this layer caps them at 5 per minute.
// Overrides BOTH global tiers for the two credential endpoints, which is
// how @nestjs/throttler scopes a limit to a route: name the tier and give
// it new numbers. Only /register and /login carry this — /me is hit on
// every page load and stays on the global tiers.
const AUTH_LIMIT = {
  short: { limit: 5, ttl: 60_000 },
  default: { limit: 5, ttl: 60_000 },
} as const;

const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // matches JWT_EXPIRES_IN default

/*
  Cookie attributes, derived per request and shared by set and clear so the
  browser can match them on removal.

  The deployed frontend (Vercel) and this API (Render) are different
  registrable domains, so every authenticated call is cross-site — and a
  SameSite=Lax cookie is never attached to one of those. Login would look
  like it succeeded and every request after it would 401. Cross-site needs
  SameSite=None, which browsers only honour together with Secure.

  This keys off the actual protocol rather than NODE_ENV on purpose: the
  README's main path is `docker compose up`, which runs this image with
  NODE_ENV=production but serves plain http on localhost. Keying off the
  environment would have sent SameSite=None without a usable Secure context
  there and broken local sign-in. Over http we are same-origin anyway, so
  Lax is both correct and sufficient.
*/
function authCookieOptions(req: Request) {
  const isHttps =
    req.secure || (req.headers['x-forwarded-proto'] ?? '').toString().split(',')[0] === 'https';
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? ('none' as const) : ('lax' as const),
    path: '/',
  };
}

/** Set the JWT as an httpOnly cookie on the response. */
function setAuthCookie(req: Request, res: Response, token: string): void {
  res.cookie(AUTH_COOKIE, token, { ...authCookieOptions(req), maxAge: COOKIE_MAX_AGE_MS });
}

/** Clear the auth cookie (used by /auth/logout). */
function clearAuthCookie(req: Request, res: Response): void {
  res.clearCookie(AUTH_COOKIE, authCookieOptions(req));
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(AUTH_LIMIT)
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(dto);
    setAuthCookie(req, res, result.access_token);
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
    const result = await this.auth.login(dto);
    setAuthCookie(req, res, result.access_token);
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    clearAuthCookie(req, res);
    return { ok: true };
  }

  // /me is hit on every page load by the SPA, so it deliberately carries
  // no @Throttle override and runs under the ordinary global tiers.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() jwt: JwtPayload) {
    return this.auth.getMe(jwt.sub);
  }
}
