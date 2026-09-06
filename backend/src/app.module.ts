import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { BoardsModule } from './boards/boards.module';
import { ColumnsModule } from './columns/columns.module';
import { LabelsModule } from './labels/labels.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    /*
      ── Rate limiting ────────────────────────────────────────────────
      Every throttler named here applies to EVERY route. `@Throttle` does
      not opt a route in — it overrides the named tier's numbers for that
      route. An earlier revision declared a 5-req/minute 'auth' tier here
      intending it for login only; because it was global, six requests to
      any endpoint (a board load plus a couple of drags) locked the caller
      out for a minute. `/api/health` returned 429.

      So the tiers below are the ones every caller should live under, and
      the auth routes tighten them via @Throttle in AuthController:
        - 'short'   1s  / 30  — blunts scripted floods without touching
                                real interaction. Inline task entry keeps
                                the composer open for rapid typing and
                                quick successive drags each fire a PATCH,
                                so a human genuinely does several req/sec.
        - 'default' 60s / 200 — sustained per-IP cap.
    */
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: 1_000, limit: 30 },
        { name: 'default', ttl: 60_000, limit: 200 },
      ],
      // The e2e suite fires hundreds of requests from one IP in seconds.
      errorMessage: 'Too many requests — please slow down and try again.',
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    BoardsModule,
    ColumnsModule,
    TasksModule,
    LabelsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Apply ThrottlerGuard globally so every route is rate-limited
    // unless explicitly skipped via @SkipThrottle().
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
