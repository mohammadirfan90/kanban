import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const ACTOR_SOCKET_HEADER = 'x-socket-id';

/**
 * The socket id of the client making this HTTP request, if it has one.
 *
 * The frontend sends its connected socket id as a header on every mutation.
 * The server echoes it back on the resulting broadcast so that client can drop
 * its own event: it already applied the change optimistically, and re-applying
 * would fight its local state — most visibly mid-drag, where it would yank the
 * card out from under the cursor.
 *
 * Passed explicitly down to the services rather than stashed in a
 * request-scoped provider. It is untrusted display-layer data with no
 * authority attached, so making it a visible parameter is both cheaper than
 * request scoping and honest about what it is: at worst a client lies and
 * suppresses an event for itself, which harms only that client.
 */
export const ActorSocket = createParamDecorator(
  (_data: undefined, ctx: ExecutionContext): string | null => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const raw = req.headers[ACTOR_SOCKET_HEADER];
    const value = Array.isArray(raw) ? raw[0] : raw;
    // Socket.IO ids are short base64url-ish strings; cap the length so a
    // hostile client cannot push arbitrary payload through a broadcast field.
    return typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : null;
  },
);
