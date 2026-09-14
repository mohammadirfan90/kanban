import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import type { TaskView } from '../common/task-view';
import {
  MEMBER_EVENT,
  PUBLIC_EVENT,
  memberRoom,
  publicRoom,
  type BoardEvent,
  type PresenceUser,
  type TaskMovedPayload,
} from './realtime.types';

/**
 * The seam domain services broadcast through.
 *
 * Deliberately not the gateway itself: TasksService, ColumnsService and
 * BoardsService inject *this*, and the gateway injects it too and hands it the
 * `Server` once Socket.IO is up. Without that split, every domain module would
 * import the gateway and the gateway would import every domain module — a
 * circular graph that Nest resolves only with forwardRef.
 *
 * Every method is a no-op when no server is attached, so the HTTP API works
 * unchanged if websockets are disabled or fail to initialise. Realtime is an
 * enhancement here, never a dependency.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  /** Board id -> socket id -> presence. Ephemeral, per-instance. */
  private readonly presence = new Map<string, Map<string, PresenceUser>>();

  attach(server: Server): void {
    this.server = server;
  }

  // ── board mutations ─────────────────────────────────────────────────

  taskCreated(boardId: string, task: TaskView, actor: string | null): void {
    this.toMembers(boardId, MEMBER_EVENT.taskCreated, { actorSocketId: actor, data: task });
    this.toPublic(boardId);
  }

  taskUpdated(boardId: string, task: TaskView, actor: string | null): void {
    this.toMembers(boardId, MEMBER_EVENT.taskUpdated, { actorSocketId: actor, data: task });
    this.toPublic(boardId);
  }

  taskMoved(boardId: string, payload: TaskMovedPayload, actor: string | null): void {
    this.toMembers(boardId, MEMBER_EVENT.taskMoved, { actorSocketId: actor, data: payload });
    this.toPublic(boardId);
  }

  taskDeleted(boardId: string, taskId: string, columnId: string, actor: string | null): void {
    this.toMembers(boardId, MEMBER_EVENT.taskDeleted, {
      actorSocketId: actor,
      data: { taskId, columnId },
    });
    this.toPublic(boardId);
  }

  columnsChanged(boardId: string, actor: string | null): void {
    // Columns are few and cheap to refetch, so one invalidation covers create,
    // rename, delete and reorder without four payload shapes to keep in step.
    this.toMembers(boardId, MEMBER_EVENT.boardInvalidated, { actorSocketId: actor, data: null });
    this.toPublic(boardId);
  }

  /** Labels, members, board title — no fine-grained event; clients refetch. */
  boardInvalidated(boardId: string, actor: string | null): void {
    this.toMembers(boardId, MEMBER_EVENT.boardInvalidated, { actorSocketId: actor, data: null });
    this.toPublic(boardId);
  }

  /**
   * A member lost access.
   *
   * Without this their open tab keeps receiving board updates until they
   * happen to reload — membership is checked when joining the room, so nothing
   * else would ever re-check it. The gateway force-leaves their sockets.
   */
  accessRevoked(boardId: string, userId: string): void {
    if (!this.server) return;
    const room = this.presence.get(boardId);
    if (!room) return;
    for (const [socketId, user] of room) {
      if (user.userId !== userId) continue;
      this.server.to(socketId).emit(MEMBER_EVENT.accessRevoked, { boardId });
      this.server.sockets.sockets.get(socketId)?.leave(memberRoom(boardId));
      room.delete(socketId);
    }
    this.broadcastPresence(boardId);
  }

  // ── presence ────────────────────────────────────────────────────────

  addPresence(boardId: string, socketId: string, user: Omit<PresenceUser, 'draggingTaskId'>): void {
    const room = this.presence.get(boardId) ?? new Map<string, PresenceUser>();
    room.set(socketId, { ...user, draggingTaskId: null });
    this.presence.set(boardId, room);
    this.broadcastPresence(boardId);
  }

  removePresence(socketId: string): void {
    for (const [boardId, room] of this.presence) {
      if (room.delete(socketId)) {
        if (room.size === 0) this.presence.delete(boardId);
        this.broadcastPresence(boardId);
      }
    }
  }

  setDragging(boardId: string, socketId: string, taskId: string | null): void {
    const room = this.presence.get(boardId);
    const user = room?.get(socketId);
    if (!room || !user) return;
    room.set(socketId, { ...user, draggingTaskId: taskId });
    this.broadcastPresence(boardId);
  }

  /**
   * One presence list per board, deduplicated by user.
   *
   * Two tabs are one person, so the avatar row should show them once — but the
   * drag indicator must survive the merge, otherwise opening a second tab would
   * make your own drag highlight vanish.
   */
  private broadcastPresence(boardId: string): void {
    if (!this.server) return;
    const room = this.presence.get(boardId);
    const byUser = new Map<string, PresenceUser>();
    for (const user of room?.values() ?? []) {
      const existing = byUser.get(user.userId);
      byUser.set(user.userId, {
        ...user,
        draggingTaskId: user.draggingTaskId ?? existing?.draggingTaskId ?? null,
      });
    }
    this.server.to(memberRoom(boardId)).emit(MEMBER_EVENT.presenceState, {
      users: [...byUser.values()],
    });
  }

  // ── plumbing ────────────────────────────────────────────────────────

  private toMembers<T>(boardId: string, event: string, payload: BoardEvent<T>): void {
    if (!this.server) return;
    this.server.to(memberRoom(boardId)).emit(event, payload);
  }

  /** Anonymous viewers only ever learn that something changed. */
  private toPublic(boardId: string): void {
    if (!this.server) return;
    this.server.to(publicRoom(boardId)).emit(PUBLIC_EVENT.invalidated, {});
  }
}
