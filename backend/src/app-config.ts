import { ValidationPipe } from '@nestjs/common';
import type { INestApplication, NestApplicationOptions } from '@nestjs/common';
import { json, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Options for `NestFactory.create` and, crucially, for the e2e suites'
 * `createNestApplication`.
 *
 * `bodyParser: false` is a CSRF control, not a tidy-up.
 *
 * The JWT lives in a cookie, and in production that cookie must be
 * SameSite=None (the frontend and this API are different registrable domains),
 * so the browser attaches it to cross-site requests. CORS does not save us: the
 * origin callback returns `callback(null, false)`, which only withholds the
 * response headers — the handler still runs.
 *
 * A cross-site HTML form can only send three content types, none of which
 * trigger a preflight: urlencoded, text/plain and multipart. Nest enables the
 * urlencoded parser by default, so a hidden auto-submitting form was enough to
 * call `POST /boards/:id/share` as the victim and grant an attacker EDITOR on a
 * private board. `application/json` cannot be produced by a form and always
 * preflights, which CORS then blocks — so parsing JSON and nothing else removes
 * the entire vector. See test/security/csrf.e2e-spec.ts.
 */
export const NEST_APP_OPTIONS: NestApplicationOptions = { bodyParser: false };

/**
 * Everything the HTTP layer needs, applied identically in production and in
 * tests.
 *
 * This exists because the two used to be configured separately: every e2e suite
 * hand-rolled its own `setGlobalPrefix` + `ValidationPipe` + filter and got
 * neither helmet, nor cookie parsing, nor the JSON-only body parser — so the
 * suite could not have caught a regression in any of them, and its pipe even
 * differed from production's (no `enableImplicitConversion`). One function, one
 * configuration, exercised by the tests that are supposed to defend it.
 *
 * CORS and `listen` stay in main.ts: both are environment-specific and neither
 * applies to supertest, which issues in-process requests with no origin.
 */
export function configureApp(app: INestApplication): INestApplication {
  // Before CORS, so even a rejected origin still receives the headers.
  // The CSP is strict because this API serves JSON only — no HTML, no scripts.
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

  // helmet on Express still emits `X-Powered-By: helmet`. Strip it entirely so
  // the stack cannot be fingerprinted from a response header.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.removeHeader('X-Powered-By');
    next();
  });

  // JSON only — see NEST_APP_OPTIONS. Anything a cross-site form can produce is
  // left unparsed, reaches the validation pipe as an empty body, and is rejected.
  app.use(json({ limit: '1mb' }));

  // Required for JwtStrategy to read the httpOnly `kanban_token` cookie.
  app.use(cookieParser());

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

  return app;
}
