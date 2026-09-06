import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Disable the `X-Powered-By: Express` header (information disclosure).
    // Helmet (below) adds `X-Powered-By: helmet` on top of this — which
    // is fine because it confirms the middleware is active.
    // NestJS doesn't expose a direct option, but we remove it via Express
    // app handle once the underlying HTTP server is available.
  });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // ── Security headers (helmet) ───────────────────────────────────────
  // Applied before CORS so even rejected origins get the headers.
  // CSP is intentionally permissive here because this API serves JSON
  // only — no HTML, no scripts, no images — so the default helmet CSP
  // is fine for an API. Tighten if you ever serve HTML from this origin.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // API serves no embeds; keep permissive
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    }),
  );

  // Belt-and-braces: helmet on Express still emits `X-Powered-By: helmet`
  // by default. Strip it entirely so attackers can't fingerprint the stack.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.removeHeader('X-Powered-By');
    next();
  });

  // Required for JwtStrategy to read the httpOnly `kanban_token` cookie.
  app.use(cookieParser());

  const corsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  const allowedOrigins = corsOrigin
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/+$/, '');
      const isAllowed = allowedOrigins.some((allowed) => {
        if (allowed === '*') return true;
        if (allowed.startsWith('*.')) {
          const suffix = allowed.slice(1);
          return normalizedOrigin.endsWith(suffix);
        }
        if (allowed.startsWith('https://*.') || allowed.startsWith('http://*.')) {
          const proto = allowed.startsWith('https://') ? 'https://' : 'http://';
          const suffix = allowed.slice(proto.length + 1);
          return normalizedOrigin.startsWith(proto) && normalizedOrigin.endsWith(suffix);
        }
        return normalizedOrigin === allowed;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn(
          `CORS blocked: Origin '${origin}' not permitted by [${allowedOrigins.join(', ')}]`,
        );
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const port = Number(config.get<string>('PORT', '3001'));
  await app.listen(port);

  logger.log(`API listening on http://localhost:${port}/api (CORS: ${corsOrigin})`);
}

void bootstrap();
