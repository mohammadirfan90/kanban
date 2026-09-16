// Socket.IO client — one connection shared by the whole tab.
//
// Realtime is an enhancement, never a dependency. Every export here degrades to
// a no-op if the socket cannot connect, and the board keeps working exactly as
// it did before over plain HTTP.

import { io, type Socket } from 'socket.io-client';

/** Server events for board members. Mirrors realtime.types.ts on the backend. */
export const MEMBER_EVENT = {
  taskCreated: 'task:created',
  taskUpdated: 'task:updated',
  taskMoved: 'task:moved',
  taskDeleted: 'task:deleted',
  boardInvalidated: 'board:invalidated',
  accessRevoked: 'board:access-revoked',
  presenceState: 'presence:state',
} as const;

export interface PresenceUser {
  userId: string;
  name: string;
  avatarUrl: string | null;
  draggingTaskId: string | null;
}

/** Every member broadcast carries the socket that caused it. */
export interface BoardEvent<T> {
  actorSocketId: string | null;
  data: T;
}

function socketOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
  // The gateway lives at the server root, not under /api.
  return raw.trim().replace(/\/+$/, '').replace(/\/api$/, '');
}

let socket: Socket | null = null;

/**
 * The shared socket, created on first use.
 *
 * `withCredentials` matters: the JWT lives in an httpOnly cookie, and the
 * browser only attaches cookies to the websocket handshake when asked. Without
 * it the gateway would see every connection as anonymous and refuse to join
 * any board room.
 */
export function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  if (!socket) {
    socket = io(socketOrigin(), {
      withCredentials: true,
      // Poll first, then upgrade. Some hosts (and corporate proxies) refuse a
      // cold websocket; falling back to long-polling keeps realtime working
      // rather than failing shut.
      transports: ['polling', 'websocket'],
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

/**
 * Our own socket id, sent as `X-Socket-Id` on every mutation so the server can
 * stamp the resulting broadcast and we can ignore our own echo.
 */
export function currentSocketId(): string | null {
  return socket?.id ?? null;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
