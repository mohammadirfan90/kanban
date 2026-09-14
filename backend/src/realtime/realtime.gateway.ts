import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as cookie from 'cookie';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { BoardsService } from '../boards/boards.service';
import { PublicLinksService } from '../boards/public-links.service';
import { AUTH_COOKIE, type JwtPayload } from '../auth/strategies/jwt.strategy';
import { RealtimeService } from './realtime.service';
import { memberRoom, publicRoom } from './realtime.types';

/** What we hang off the socket once the handshake is understood. */
interface SocketState {
  userId: string | null;
  name: string | null;
  boardIds: Set<string>;
}

@WebSocketGateway({
  // Same allowlist as the REST CORS, and credentials on, because the JWT rides
  // in a cookie that the browser only attaches to the handshake when asked.
  cors: {
    origin: (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => {
      const allowed = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
        .split(',')
        .map((o) => o.trim().replace(/\/+$/, ''))
        .filter(Boolean);
      if (!origin) return cb(null, true);
      const normalized = origin.replace(/\/+$/, '');
      cb(null, allowed.includes('*') || allowed.includes(normalized));
    },
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly state = new Map<string, SocketState>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly realtime: RealtimeService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly boards: BoardsService,
    private readonly publicLinks: PublicLinksService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.attach(server);
    this.logger.log('Realtime gateway ready');
  }

  /**
   * Identify the connection, but do not authorise anything yet.
   *
   * An anonymous socket is allowed: it is how a public-link visitor receives
   * invalidations. Authorisation happens per room in the join handlers, where
   * the board is actually known.
   */
  handleConnection(client: Socket): void {
    const payload = this.identify(client);
    this.state.set(client.id, {
      userId: payload?.sub ?? null,
      name: null,
      boardIds: new Set(),
    });
  }

  handleDisconnect(client: Socket): void {
    this.realtime.removePresence(client.id);
    this.state.delete(client.id);
  }

  /** Join a board as an authenticated member. Membership is verified here. */
  @SubscribeMessage('board:join')
  async joinBoard(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { boardId?: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.state.get(client.id);
    const boardId = body?.boardId;
    if (!state?.userId || !boardId) {
      return { ok: false, error: 'unauthenticated' };
    }

    // The same check the REST layer uses — a socket must not be a way around it.
    const allowed = await this.boards.hasAccess(state.userId, boardId, 'VIEWER');
    if (!allowed) {
      return { ok: false, error: 'forbidden' };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: state.userId },
      select: { name: true },
    });

    await client.join(memberRoom(boardId));
    state.boardIds.add(boardId);
    state.name = user?.name ?? 'Someone';
    this.realtime.addPresence(boardId, client.id, { userId: state.userId, name: state.name });
    return { ok: true };
  }

  /**
   * Join as an anonymous public-link viewer.
   *
   * The slug is resolved through the same service the REST endpoint uses, so a
   * revoked link cannot be used to keep listening. These sockets land in a
   * separate room that only ever receives invalidations — never entity
   * payloads, which carry member emails.
   */
  @SubscribeMessage('public:join')
  async joinPublic(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { slug?: string },
  ): Promise<{ ok: boolean }> {
    const slug = body?.slug;
    if (!slug) return { ok: false };

    const link = await this.prisma.boardPublicLink.findUnique({
      where: { slug },
      select: { boardId: true, revokedAt: true },
    });
    if (!link || link.revokedAt) return { ok: false };

    await client.join(publicRoom(link.boardId));
    return { ok: true };
  }

  @SubscribeMessage('board:leave')
  async leaveBoard(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { boardId?: string },
  ): Promise<void> {
    const boardId = body?.boardId;
    if (!boardId) return;
    await client.leave(memberRoom(boardId));
    this.state.get(client.id)?.boardIds.delete(boardId);
    this.realtime.removePresence(client.id);
  }

  /**
   * Presence only — never a source of truth.
   *
   * The card someone is dragging is cosmetic, so it is not persisted and not
   * validated beyond membership. The authoritative move still goes through
   * PATCH /tasks/:id/move like any other client.
   */
  @SubscribeMessage('presence:drag')
  dragging(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { boardId?: string; taskId?: string | null },
  ): void {
    const state = this.state.get(client.id);
    if (!state?.userId || !body?.boardId || !state.boardIds.has(body.boardId)) return;
    this.realtime.setDragging(body.boardId, client.id, body.taskId ?? null);
  }

  /** Read the JWT out of the handshake cookie, or the auth payload for non-browser clients. */
  private identify(client: Socket): JwtPayload | null {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) return null;

    const header = client.handshake.headers.cookie;
    const fromCookie = header ? cookie.parse(header)[AUTH_COOKIE] : undefined;
    const fromAuth = (client.handshake.auth as { token?: string } | undefined)?.token;
    const token = fromCookie ?? fromAuth;
    if (!token) return null;

    try {
      return this.jwt.verify<JwtPayload>(token, { secret });
    } catch {
      // Expired or forged: the socket stays anonymous rather than being
      // rejected, so a public-link viewer with a stale cookie still works.
      return null;
    }
  }
}
