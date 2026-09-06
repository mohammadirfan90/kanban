'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError } from '@/lib/api';
import { getBoard } from '@/lib/boards';
import {
  createColumn,
  deleteColumn,
  reorderColumns,
  updateColumn,
  type ColumnResponse,
} from '@/lib/columns';
import {
  createTask,
  deleteTask,
  moveTask,
  updateTask,
  type CreateTaskInput,
  type MoveTaskInput,
  type TaskResponse,
  type UpdateTaskInput,
} from '@/lib/tasks';
import type { Board, BoardColumn, BoardLabel, BoardTask } from '@/lib/types';

export type BoardLoadErrorKind = 'not-found' | 'forbidden' | 'unknown';

export interface BoardLoadError {
  kind: BoardLoadErrorKind;
  message: string;
}

export interface CreateColumnInput {
  title: string;
}

/** Where a dragged task should sit relative to the task it is hovering over. */
export type Placement = 'before' | 'after';

export interface PreviewTarget {
  columnId: string;
  /** The task being hovered, or null when hovering the column's empty space. */
  overTaskId?: string | null;
  placement?: Placement;
}

export interface UpdateColumnInput {
  title?: string;
}

export interface UseBoardDataResult {
  board: Board | null;
  loading: boolean;
  error: BoardLoadError | null;
  /** True when the caller can mutate (EDITOR or OWNER). VIEWER = read-only. */
  canEdit: boolean;
  refresh: () => Promise<void>;
  // Tasks
  handleCreateTask: (columnId: string, input: CreateTaskInput) => Promise<void>;
  handleUpdateTask: (taskId: string, input: UpdateTaskInput) => Promise<void>;
  handleDeleteTask: (taskId: string) => Promise<void>;
  handleMoveTask: (taskId: string, input: MoveTaskInput) => Promise<void>;
  // Columns
  handleCreateColumn: (input: CreateColumnInput) => Promise<void>;
  handleUpdateColumn: (columnId: string, input: UpdateColumnInput) => Promise<void>;
  handleDeleteColumn: (columnId: string) => Promise<void>;
  /**
   * Merge a label created elsewhere (the task dialogs create them inline) into
   * the board's list, so the picker shows it without a refetch.
   */
  addLabel: (label: BoardLabel) => void;
  // Drag session — see the "live drag preview" note on the hook.
  beginDrag: () => void;
  previewTaskMove: (taskId: string, target: PreviewTarget) => void;
  previewColumnMove: (columnId: string, overColumnId: string) => void;
  commitTaskDrag: (taskId: string, target: PreviewTarget | null) => Promise<void>;
  commitColumnDrag: () => Promise<void>;
  cancelDrag: () => void;
}

/** Prefix for the client-side id a task carries until the server assigns one. */
const OPTIMISTIC_ID_PREFIX = 'optimistic:';

export const isOptimisticId = (id: string): boolean => id.startsWith(OPTIMISTIC_ID_PREFIX);

const newOptimisticId = (): string =>
  `${OPTIMISTIC_ID_PREFIX}${
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  }`;

/** Tasks come from the API already ordered; keep that order when re-sorting. */
const byPosition = (a: BoardTask, b: BoardTask): number =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : 0;

// ── pure board transforms ─────────────────────────────────────────────
// Module scope on purpose: these close over nothing, so defining them inside
// the component would make each one a new identity every render and force
// every mutator's useCallback to re-create.

const mapColumn = (
  b: Board,
  columnId: string,
  fn: (column: BoardColumn) => BoardColumn,
): Board => ({
  ...b,
  columns: b.columns.map((c) => (c.id === columnId ? fn(c) : c)),
});

const withoutTask = (b: Board, taskId: string): Board => ({
  ...b,
  columns: b.columns.map((c) => ({ ...c, tasks: c.tasks.filter((t) => t.id !== taskId) })),
});

const findTask = (b: Board, taskId: string): BoardTask | undefined => {
  for (const c of b.columns) {
    const found = c.tasks.find((t) => t.id === taskId);
    if (found) return found;
  }
  return undefined;
};

/** Resolve a member to the assignee shape a task carries, or null. */
const memberAsAssignee = (b: Board, userId: string | null | undefined) => {
  if (!userId) return null;
  const m = b.members.find((x) => x.userId === userId);
  return m ? { id: m.userId, name: m.name, email: m.email } : null;
};

/** Insert `task` into `columnId` at `index`, preserving array order. */
const insertTaskAt = (b: Board, columnId: string, index: number, task: BoardTask): Board =>
  mapColumn(b, columnId, (c) => {
    const tasks = [...c.tasks];
    tasks.splice(Math.max(0, Math.min(index, tasks.length)), 0, { ...task, columnId });
    return { ...c, tasks };
  });

/**
 * The index a dragged task should occupy, given what it is hovering over.
 *
 * `siblings` must already exclude the dragged task, so the index is expressed
 * in the list the task is about to be inserted into rather than the one it is
 * leaving. Hovering nothing in particular (the column's empty space) appends.
 */
const resolveIndex = (
  siblings: readonly BoardTask[],
  overTaskId: string | null | undefined,
  placement: Placement = 'before',
): number => {
  if (!overTaskId) return siblings.length;
  const idx = siblings.findIndex((t) => t.id === overTaskId);
  if (idx < 0) return siblings.length;
  return placement === 'after' ? idx + 1 : idx;
};

/** Current column + index of a task, or null if it isn't on the board. */
const locateTask = (b: Board, taskId: string): { columnId: string; index: number } | null => {
  for (const c of b.columns) {
    const index = c.tasks.findIndex((t) => t.id === taskId);
    if (index >= 0) return { columnId: c.id, index };
  }
  return null;
};

/** Replace a task by id and re-sort its column by the server's ordering key. */
const reconcileTask = (b: Board, taskId: string, next: TaskResponse): Board => {
  const stripped = withoutTask(b, taskId);
  return mapColumn(stripped, next.columnId, (c) => ({
    ...c,
    tasks: [...c.tasks, next].sort(byPosition),
  }));
};

/**
 * Loads a board and exposes genuinely optimistic mutators for tasks + columns.
 *
 * Every mutator follows the same shape:
 *
 *   1. Snapshot the board.
 *   2. Apply the change to local state **immediately** — the UI updates in the
 *      same frame as the interaction, before any network call.
 *   3. Call the API.
 *   4. On success, reconcile with the server response. The server is canonical:
 *      it owns the ordering key, the timestamps, and the real task id.
 *   5. On failure, restore the snapshot and rethrow so the caller can toast.
 *
 * Live drag preview
 * -----------------
 * `beginDrag` / `previewTaskMove` / `commitTaskDrag` / `cancelDrag` form a drag
 * session. The preview calls rewrite local state only — no network — so the
 * board reorders under the cursor as the user drags. `commitTaskDrag` then sends
 * exactly what the user is looking at, and rolls back to the pre-drag snapshot
 * if the server rejects it.
 *
 * The snapshot is taken at `beginDrag`, not per-preview: a drag produces dozens
 * of preview calls, and rolling back to the most recent one would restore a
 * half-dragged state rather than where the card started.
 *
 * Ordering note: task arrays are kept in display order. Optimistic moves splice
 * the array directly rather than inventing an ordering key, because keys are
 * opaque server-generated strings (see `OrderKey`) and a client has no way to
 * mint a valid one. Reconciliation re-sorts by the key the server returns, so a
 * server-side conflict retry that lands the task somewhere other than where the
 * user dropped it self-corrects on the next frame.
 */
export function useBoardData(id: string): UseBoardDataResult {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<BoardLoadError | null>(null);

  const boardRef = useRef<Board | null>(null);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  // How many mutations are awaiting a response. Used to decide whether a
  // failed mutation can safely roll back to its own snapshot (see `mutate`).
  const inFlightRef = useRef(0);

  const canEdit = board != null && (board.role === 'OWNER' || board.role === 'EDITOR');

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBoard(id);
      setBoard(data);
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.status === 404) {
          setError({ kind: 'not-found', message: e.message });
        } else if (e.status === 403) {
          setError({ kind: 'forbidden', message: e.message });
        } else {
          setError({ kind: 'unknown', message: e.message });
        }
      } else {
        setError({ kind: 'unknown', message: 'Could not load board' });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);

  /**
   * Run one optimistic mutation.
   *
   * `apply` must be pure — it may be called once and its result rendered
   * before `commit` has even been dispatched.
   *
   * Rollback is deliberately not a blanket "restore the snapshot". If another
   * mutation is still in flight, that snapshot predates it, and restoring it
   * would silently undo an unrelated change the user made a moment later.
   * In that case we refetch instead: slower, but it can't lose work.
   */
  const mutate = useCallback(
    async <T,>(
      apply: (board: Board) => Board,
      commit: () => Promise<T>,
      reconcile: (board: Board, result: T) => Board,
    ): Promise<T> => {
      const snapshot = boardRef.current;
      if (!snapshot) {
        throw new Error('Board is not loaded');
      }

      const optimistic = apply(snapshot);
      boardRef.current = optimistic;
      setBoard(optimistic);

      inFlightRef.current += 1;
      try {
        const result = await commit();
        setBoard((prev) => (prev ? reconcile(prev, result) : prev));
        return result;
      } catch (e) {
        if (inFlightRef.current > 1) {
          void fetchBoard();
        } else {
          boardRef.current = snapshot;
          setBoard(snapshot);
        }
        throw e;
      } finally {
        inFlightRef.current -= 1;
      }
    },
    [fetchBoard],
  );

  const addLabel = useCallback((label: BoardLabel): void => {
    setBoard((prev) => {
      if (!prev || prev.labels.some((l) => l.id === label.id)) return prev;
      return { ...prev, labels: [...prev.labels, label] };
    });
  }, []);

  // ── drag session ────────────────────────────────────────────────────

  // State as it was before the drag started, so a rejected drop can restore it.
  const dragSnapshotRef = useRef<Board | null>(null);

  /**
   * Recent preview targets within the current drag, most recent last.
   *
   * Guards against a feedback loop that is inherent to previewing during a
   * drag: applying a move changes the layout, the new layout changes what sits
   * under the motionless cursor, and that proposes moving back. The two
   * positions then alternate every frame until React gives up with error #185
   * and unmounts the board mid-drag.
   *
   * Refusing a target that merely reverts the previous one breaks the cycle
   * while still allowing a genuine A -> B -> C progression, because C is not in
   * the recent history. The pointer only has to move a little for the drag to
   * continue normally.
   */
  const previewHistoryRef = useRef<string[]>([]);

  const shouldSkipPreview = useCallback((signature: string): boolean => {
    const history = previewHistoryRef.current;
    // Already there, or this would flip straight back to where it just was.
    if (history[history.length - 1] === signature) return true;
    if (history[history.length - 2] === signature) return true;
    history.push(signature);
    if (history.length > 4) history.shift();
    return false;
  }, []);

  /** Write local state and keep `boardRef` in step, so back-to-back previews
   *  within one drag frame compose instead of racing. */
  const applyLocal = useCallback((next: (b: Board) => Board): void => {
    const current = boardRef.current;
    if (!current) return;
    const updated = next(current);
    if (updated === current) return;
    boardRef.current = updated;
    setBoard(updated);
  }, []);

  const beginDrag = useCallback(() => {
    dragSnapshotRef.current = boardRef.current;
    previewHistoryRef.current = [];
  }, []);

  /** Move a task to `target` in local state. Unconditional; used by the drop. */
  const applyTaskPlacement = useCallback(
    (taskId: string, target: PreviewTarget): void => {
      applyLocal((b) => {
        const task = findTask(b, taskId);
        if (!task) return b;

        const column = b.columns.find((c) => c.id === target.columnId);
        if (!column) return b;

        const siblings = column.tasks.filter((t) => t.id !== taskId);
        const index = resolveIndex(siblings, target.overTaskId, target.placement);

        // Bail when nothing would change. Without this, every pointer move
        // re-renders the whole board and the drag stutters.
        const at = locateTask(b, taskId);
        if (at && at.columnId === target.columnId && at.index === index) return b;

        return insertTaskAt(withoutTask(b, taskId), target.columnId, index, task);
      });
    },
    [applyLocal],
  );

  /**
   * Preview a task hovering `target`, for **cross-column moves only**.
   *
   * Reordering within a column is deliberately not previewed. dnd-kit's
   * `verticalListSortingStrategy` already shifts the siblings with transforms,
   * so the gap opens without touching state — and mutating state there creates
   * a feedback loop: the move changes the layout, the layout changes what is
   * under the cursor, which moves it back. That oscillates until React aborts
   * the render with error #185 ("maximum update depth exceeded") and the board
   * unmounts mid-drag. Cross-column moves are self-limiting, because once the
   * task has moved the target column *is* its column and this returns early.
   */
  const previewTaskMove = useCallback(
    (taskId: string, target: PreviewTarget): void => {
      const current = boardRef.current;
      if (!current) return;
      const at = locateTask(current, taskId);
      if (at && at.columnId === target.columnId) return;
      if (shouldSkipPreview(`task:${taskId}:${target.columnId}`)) return;
      applyTaskPlacement(taskId, target);
    },
    [applyTaskPlacement, shouldSkipPreview],
  );

  const previewColumnMove = useCallback(
    (columnId: string, overColumnId: string): void => {
      if (shouldSkipPreview(`column:${columnId}:${overColumnId}`)) return;
      applyLocal((b) => {
        const from = b.columns.findIndex((c) => c.id === columnId);
        const to = b.columns.findIndex((c) => c.id === overColumnId);
        if (from < 0 || to < 0 || from === to) return b;
        const columns = [...b.columns];
        const [moved] = columns.splice(from, 1);
        columns.splice(to, 0, moved);
        return { ...b, columns };
      });
    },
    [applyLocal, shouldSkipPreview],
  );

  const restoreDragSnapshot = useCallback((): void => {
    const snapshot = dragSnapshotRef.current;
    if (!snapshot) return;
    boardRef.current = snapshot;
    setBoard(snapshot);
  }, []);

  const cancelDrag = useCallback((): void => {
    restoreDragSnapshot();
    dragSnapshotRef.current = null;
    previewHistoryRef.current = [];
  }, [restoreDragSnapshot]);

  /**
   * Apply the drop and persist it.
   *
   * `target` is where the pointer was released. Cross-column moves have
   * usually been previewed already, in which case applying it again is a
   * no-op; a within-column reorder has *not* been previewed (see
   * `previewTaskMove`) and lands here for the first time. Running both through
   * the same placement code means the drop can never disagree with the preview.
   */
  const commitTaskDrag = useCallback(
    async (taskId: string, target: PreviewTarget | null): Promise<void> => {
      const snapshot = dragSnapshotRef.current;
      dragSnapshotRef.current = null;
      if (!canEdit || !snapshot) return;

      if (target) applyTaskPlacement(taskId, target);

      const before = locateTask(snapshot, taskId);
      const after = boardRef.current ? locateTask(boardRef.current, taskId) : null;
      if (!after) return;
      // Dropped back where it started — nothing to persist.
      if (before && before.columnId === after.columnId && before.index === after.index) return;

      try {
        const moved = await moveTask(taskId, {
          targetColumnId: after.columnId,
          newIndex: after.index,
        });
        setBoard((prev) => (prev ? reconcileTask(prev, taskId, moved) : prev));
      } catch (e) {
        boardRef.current = snapshot;
        setBoard(snapshot);
        throw e;
      }
    },
    [canEdit, applyTaskPlacement],
  );

  const commitColumnDrag = useCallback(async (): Promise<void> => {
    const snapshot = dragSnapshotRef.current;
    dragSnapshotRef.current = null;
    if (!canEdit || !snapshot) return;

    const current = boardRef.current;
    if (!current) return;

    const nextOrder = current.columns.map((c) => c.id);
    const prevOrder = snapshot.columns.map((c) => c.id);
    if (nextOrder.join() === prevOrder.join()) return;

    try {
      const reordered = await reorderColumns({ boardId: id, columnIds: nextOrder });
      // Keep the tasks already in local state: the reorder response carries
      // them, but a task created mid-drag would otherwise be dropped.
      setBoard((prev) => {
        if (!prev) return prev;
        const positionById = new Map(reordered.map((c) => [c.id, c.position]));
        const byId = new Map(prev.columns.map((c) => [c.id, c]));
        return {
          ...prev,
          columns: reordered
            .map((c) => {
              const existing = byId.get(c.id);
              return existing ? { ...existing, position: positionById.get(c.id) ?? existing.position } : null;
            })
            .filter((c): c is BoardColumn => c !== null),
        };
      });
    } catch (e) {
      boardRef.current = snapshot;
      setBoard(snapshot);
      throw e;
    }
  }, [canEdit, id]);

  // ── task mutators ───────────────────────────────────────────────────

  const handleCreateTask = useCallback(
    async (columnId: string, input: CreateTaskInput): Promise<void> => {
      if (!canEdit) throw new Error('Forbidden');

      const optimisticId = newOptimisticId();
      const now = new Date().toISOString();

      await mutate(
        (b) =>
          mapColumn(b, columnId, (c) => ({
            ...c,
            tasks: [
              ...c.tasks,
              {
                id: optimisticId,
                columnId,
                boardId: b.id,
                // The server owns the key: it comes from an atomic per-board
                // counter, so a client guess would be wrong as often as not.
                // `isOptimisticId` lets the card hide it until reconciliation.
                key: '',
                number: 0,
                title: input.title,
                description: input.description ?? null,
                priority: input.priority ?? null,
                dueDate: input.dueDate ?? null,
                labels: (input.labelIds ?? [])
                  .map((id) => b.labels.find((l) => l.id === id))
                  .filter((l): l is (typeof b.labels)[number] => l !== undefined)
                  .map((l) => ({ id: l.id, name: l.name, color: l.color })),
                // Sorts after every real key: the server appends, and this
                // placeholder must land in the same place until it is replaced.
                position: '￿',
                assignee: memberAsAssignee(b, input.assigneeId),
                createdAt: now,
                updatedAt: now,
              },
            ],
          })),
        () => createTask(input),
        (b, created) => reconcileTask(b, optimisticId, created),
      );
    },
    [canEdit, mutate],
  );

  const handleUpdateTask = useCallback(
    async (taskId: string, input: UpdateTaskInput): Promise<void> => {
      if (!canEdit) throw new Error('Forbidden');

      await mutate(
        (b) => {
          const existing = findTask(b, taskId);
          if (!existing) return b;
          const assignee =
            input.assigneeId === undefined
              ? existing.assignee
              : memberAsAssignee(b, input.assigneeId);

          return mapColumn(b, existing.columnId, (c) => ({
            ...c,
            tasks: c.tasks.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    title: input.title ?? t.title,
                    description:
                      input.description === undefined ? t.description : (input.description ?? null),
                    assignee,
                  }
                : t,
            ),
          }));
        },
        () => updateTask(taskId, input),
        (b, updated) => reconcileTask(b, taskId, updated),
      );
    },
    [canEdit, mutate],
  );

  const handleDeleteTask = useCallback(
    async (taskId: string): Promise<void> => {
      if (!canEdit) throw new Error('Forbidden');
      await mutate(
        (b) => withoutTask(b, taskId),
        () => deleteTask(taskId),
        (b) => b,
      );
    },
    [canEdit, mutate],
  );

  const handleMoveTask = useCallback(
    async (taskId: string, input: MoveTaskInput): Promise<void> => {
      if (!canEdit) throw new Error('Forbidden');

      await mutate(
        (b) => {
          const task = findTask(b, taskId);
          if (!task) return b;
          return insertTaskAt(withoutTask(b, taskId), input.targetColumnId, input.newIndex, task);
        },
        () => moveTask(taskId, input),
        // The server may have placed the task elsewhere — a concurrent editor
        // took the slot and the retry landed beside it. Re-sorting on the
        // returned key snaps the card to where it actually is.
        (b, moved) => reconcileTask(b, taskId, moved),
      );
    },
    [canEdit, mutate],
  );

  // ── column mutators ─────────────────────────────────────────────────

  const handleCreateColumn = useCallback(
    async (input: CreateColumnInput): Promise<void> => {
      if (!canEdit) throw new Error('Forbidden');

      const optimisticId = newOptimisticId();
      const now = new Date().toISOString();

      await mutate(
        (b) => ({
          ...b,
          columns: [
            ...b.columns,
            {
              id: optimisticId,
              boardId: id,
              title: input.title,
              position: '￿',
              createdAt: now,
              updatedAt: now,
              tasks: [],
            } as BoardColumn,
          ],
        }),
        () => createColumn({ boardId: id, title: input.title }),
        (b, created: ColumnResponse) => ({
          ...b,
          columns: b.columns.map((c) => (c.id === optimisticId ? { ...created } : c)),
        }),
      );
    },
    [canEdit, mutate, id],
  );

  const handleUpdateColumn = useCallback(
    async (columnId: string, input: UpdateColumnInput): Promise<void> => {
      if (!canEdit) throw new Error('Forbidden');

      await mutate(
        (b) => mapColumn(b, columnId, (c) => ({ ...c, title: input.title ?? c.title })),
        () => updateColumn(columnId, input),
        (b, updated: ColumnResponse) =>
          // Keep the tasks we already hold: the column endpoint returns them,
          // but a concurrently-created task would be dropped by a blind replace.
          mapColumn(b, columnId, (c) => ({ ...c, title: updated.title })),
      );
    },
    [canEdit, mutate],
  );

  const handleDeleteColumn = useCallback(
    async (columnId: string): Promise<void> => {
      if (!canEdit) throw new Error('Forbidden');
      await mutate(
        (b) => ({ ...b, columns: b.columns.filter((c) => c.id !== columnId) }),
        () => deleteColumn(columnId),
        (b) => b,
      );
    },
    [canEdit, mutate],
  );

  return {
    board,
    loading,
    error,
    canEdit,
    refresh: fetchBoard,
    handleCreateTask,
    handleUpdateTask,
    handleDeleteTask,
    handleMoveTask,
    handleCreateColumn,
    handleUpdateColumn,
    handleDeleteColumn,
    addLabel,
    beginDrag,
    previewTaskMove,
    previewColumnMove,
    commitTaskDrag,
    commitColumnDrag,
    cancelDrag,
  };
}
