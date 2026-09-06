import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '../strategies/jwt.strategy';

/**
 * Injects the decoded JWT payload. Use it bare — `@CurrentUser() user: JwtPayload`
 * — and read `user.sub` for the id.
 *
 * The parameter is typed `undefined` on purpose: this decorator has never
 * honoured a property argument, so `@CurrentUser('id')` used to compile fine
 * and hand back the whole payload, producing a Prisma validation error deep in
 * a service instead of a mistake at the call site. Now it fails to compile.
 */
export const CurrentUser = createParamDecorator(
  (_data: undefined, ctx: ExecutionContext): JwtPayload => {
    const req = ctx.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    return req.user;
  },
);
