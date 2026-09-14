'use client';

import { useEffect, useRef, useState } from 'react';
import {
  MEMBER_EVENT,
  getSocket,
  type BoardEvent,
  type PresenceUser,
} from '@/lib/realtime';
import type { Board, BoardTask } from '@/lib/types';

export interface BoardRealtime {
  /** Everyone currently on this board, the caller included. */
  presence: PresenceUser[];
  connected: boolean;
  /** Tell others which card this tab is dragging (null when it stops). */
  broadcastDrag: (taskId: string | null) => void;
}

interface Options {
  boardId: string;
  /** Apply a pure update to the local board. */
  applyLocal: (next: (board: Board) => Board) => void;
  /** Full refetch, for events with no fine-grained payload. */
  refresh: () => Promise<void>;
  /** True while this tab is mid-drag — remote updates are deferred. */
  isDraggingRef: React.MutableRefObject<boolean>;
  /** Called when the server says this user lost access to the board. */
  onAccessRevoked?: () => void;
}

const withoutTask = (board: Board, taskId: string): Board => ({
  ...board,
  columns: board.columns.map((c) => ({ ...c, tasks: c.tasks.filter((t) => t.id !== taskId) })),
});

/** Insert a task into its column, keeping the column sorted by position key. */
const withTask = (board: Board, task: BoardTask): Board => ({
  ...board,
  columns: board.columns.map((column) => {
    if (column.id !== task.columnId) return column;
    const tasks = [...column.tasks.filter((t) => t.id !== task.id), task].sort((a, b) =>
      a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
    );
    return { ...column, tasks };
  }),
});

/**
 * Live board updates over a shared socket.
 *
 * Three rules make this safe to layer on top of the existing optimistic UI:
 *
 *  1. Drop our own echo. The server stamps every broadcast with the socket that
 *     caused it; this tab already applied that change locally.
 *  2. Never apply a remote update mid-drag. dnd-kit measures node rectangles on
 *     drag start, so re-parenting a card underneath an active drag makes the
 *     drop land somewhere the user did not aim. Remote work is deferred and
 *     replayed as a single refetch on drop.
 *  3. Sort by `position` rather than trusting arrival order. Positions are
 *     fractional-index strings that already define a total order, so two
 *     concurrent moves converge on the same sequence regardless of which event
 *     lands first.
 */
export function useBoardRealtime({
  boardId,
  applyLocal,
  refresh,
  isDraggingRef,
  onAccessRevoked,
}: Options): BoardRealtime {
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [connected, setConnected] = useState(false);
  const pendingRefresh = useRef(false);

  // Handlers change identity every render; a ref keeps the socket listeners
  // stable so they are not torn down and re-attached constantly.
  const handlers = useRef({ applyLocal, refresh, onAccessRevoked });
  handlers.current = { applyLocal, refresh, onAccessRevoked };

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !boardId) return;

    const join = () => {
      setConnected(true);
      socket.emit('board:join', { boardId });
      // A reconnect may have missed events entirely, so resync rather than
      // trying to replay a gap we cannot see.
      void handlers.current.refresh();
    };

    /** Defer while dragging; otherwise run now. */
    const apply = (fn: () => void) => {
      if (isDraggingRef.current) {
        pendingRefresh.current = true;
        return;
      }
      fn();
    };

    const isEcho = (e: BoardEvent<unknown>) => e.actorSocketId && e.actorSocketId === socket.id;

    const onCreated = (e: BoardEvent<BoardTask>) => {
      if (isEcho(e)) return;
      apply(() => handlers.current.applyLocal((b) => withTask(b, e.data)));
    };
    const onUpdated = onCreated;
    const onMoved = (e: BoardEvent<{ task: BoardTask }>) => {
      if (isEcho(e)) return;
      apply(() =>
        handlers.current.applyLocal((b) => withTask(withoutTask(b, e.data.task.id), e.data.task)),
      );
    };
    const onDeleted = (e: BoardEvent<{ taskId: string }>) => {
      if (isEcho(e)) return;
      apply(() => handlers.current.applyLocal((b) => withoutTask(b, e.data.taskId)));
    };
    const onInvalidated = (e: BoardEvent<null>) => {
      if (isEcho(e)) return;
      apply(() => void handlers.current.refresh());
    };
    const onPresence = (p: { users: PresenceUser[] }) => setPresence(p.users ?? []);
    const onRevoked = () => handlers.current.onAccessRevoked?.();

    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('disconnect', () => setConnected(false));
    socket.on(MEMBER_EVENT.taskCreated, onCreated);
    socket.on(MEMBER_EVENT.taskUpdated, onUpdated);
    socket.on(MEMBER_EVENT.taskMoved, onMoved);
    socket.on(MEMBER_EVENT.taskDeleted, onDeleted);
    socket.on(MEMBER_EVENT.boardInvalidated, onInvalidated);
    socket.on(MEMBER_EVENT.presenceState, onPresence);
    socket.on(MEMBER_EVENT.accessRevoked, onRevoked);

    return () => {
      socket.emit('board:leave', { boardId });
      socket.off('connect', join);
      socket.off(MEMBER_EVENT.taskCreated, onCreated);
      socket.off(MEMBER_EVENT.taskUpdated, onUpdated);
      socket.off(MEMBER_EVENT.taskMoved, onMoved);
      socket.off(MEMBER_EVENT.taskDeleted, onDeleted);
      socket.off(MEMBER_EVENT.boardInvalidated, onInvalidated);
      socket.off(MEMBER_EVENT.presenceState, onPresence);
      socket.off(MEMBER_EVENT.accessRevoked, onRevoked);
      setPresence([]);
    };
  }, [boardId, isDraggingRef]);

  // Whatever arrived during a drag is collapsed into one refetch on release.
  useEffect(() => {
    if (!pendingRefresh.current) return;
    const timer = setInterval(() => {
      if (isDraggingRef.current || !pendingRefresh.current) return;
      pendingRefresh.current = false;
      void handlers.current.refresh();
    }, 300);
    return () => clearInterval(timer);
  });

  const broadcastDrag = (taskId: string | null) => {
    getSocket()?.emit('presence:drag', { boardId, taskId });
  };

  return { presence, connected, broadcastDrag };
}
