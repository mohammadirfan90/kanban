import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

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
