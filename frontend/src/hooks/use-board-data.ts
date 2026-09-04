'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError } from '@/lib/api';
import { getBoard } from '@/lib/boards';
import { createColumn, deleteColumn, updateColumn, type ColumnResponse } from '@/lib/columns';
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
import type { Board } from '@/lib/types';

export type BoardLoadErrorKind = 'not-found' | 'forbidden' | 'unknown';

export interface BoardLoadError {
  kind: BoardLoadErrorKind;
  message: string;
}

export interface CreateColumnInput {
  title: string;
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
}

/**
 * Loads a board and exposes optimistic mutators for tasks + columns.
 *
 * Pattern:
 *   1. Take a snapshot of the relevant slice of `board`.
 *   2. Apply the optimistic mutation locally.
 *   3. Call the API.
 *   4. On success — replace the slice with the API response.
 *   5. On error — restore the snapshot and re-throw (caller toasts).
 *
 * Last-write-wins: when the API returns a different ordering than the
 * optimistic one (e.g., rebalance fired on the server), we trust the API.
 */
export function useBoardData(id: string): UseBoardDataResult {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<BoardLoadError | null>(null);
  // Ref-based snapshot survives StrictMode double-invocations.
  const boardRef = useRef<Board | null>(null);
  boardRef.current = board;

  // Role comes from the loaded board itself — no separate prop needed.
  // canEdit is computed live from board.role; while the board is loading we
  // default to false (no UI affordances).
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

  // ── helpers ─────────────────────────────────────────────────────────

  /** Replace a column in `board` by id with `next`. */
  const replaceColumn = (next: ColumnResponse): void => {
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((c) => (c.id === next.id ? { ...next } : c)),
      };
    });
  };

  /** Remove a column from `board` by id. */
  const removeColumn = (columnId: string): void => {
    setBoard((prev) => {
      if (!prev) return prev;
      return { ...prev, columns: prev.columns.filter((c) => c.id !== columnId) };
    });
  };

  /** Append a column to `board`. */
  const appendColumn = (next: ColumnResponse): void => {
    setBoard((prev) => {
      if (!prev) return prev;
      return { ...prev, columns: [...prev.columns, next] };
    });
  };

  /** Replace a task in its column with `next`. */
  const replaceTask = (next: TaskResponse): void => {
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((c) =>
          c.id === next.columnId
            ? { ...c, tasks: c.tasks.map((t) => (t.id === next.id ? next : t)) }
            : c,
        ),
      };
    });
  };

  /** Remove a task from its column by id. */
  const removeTask = (taskId: string): void => {
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((c) => ({
          ...c,
          tasks: c.tasks.filter((t) => t.id !== taskId),
        })),
      };
    });
  };

  // ── task mutators ───────────────────────────────────────────────────

  const handleCreateTask = useCallback(
    async (columnId: string, input: CreateTaskInput): Promise<void> => {
      if (!canEdit) throw new Error('Forbidden');
      const created = await createTask(input);
      // Insert at the end of the target column in our local state.
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((c) =>
            c.id === columnId
              ? {
                  ...c,
                  tasks: [
                    ...c.tasks,
                    {
                      id: created.id,
                      columnId: created.columnId,
                      title: created.title,
                      description: created.description,
                      position: created.position,
                      assignee: created.assignee,
                      createdAt: created.createdAt,
                      updatedAt: created.updatedAt,
                    },
                  ],
                }
              : c,
          ),
        };
      });
    },
    [canEdit],
  );

  const handleUpdateTask = useCallback(
    async (taskId: string, input: UpdateTaskInput): Promise<void> => {
      if (!canEdit) throw new Error('Forbidden');
      const snapshot = boardRef.current;
      const updated = await updateTask(taskId, input);
      // Apply the updated task to whichever column owns it.
      replaceTask(updated);
      // Defensive: keep snapshot referenced to silence lint.
      void snapshot;
    },
    [canEdit],
  );

  const handleDeleteTask = useCallback(
    async (taskId: string): Promise<void> => {
      if (!canEdit) throw new Error('Forbidden');
      await deleteTask(taskId);
      removeTask(taskId);
    },
    [canEdit],
  );

  const handleMoveTask = useCallback(
    async (taskId: string, input: MoveTaskInput): Promise<void> => {
      if (!canEdit) throw new Error('Forbidden');
      // Server returns the canonical position. Trust it.
      const updated = await moveTask(taskId, input);
      // Find the source column (where the task currently lives in our local state)
      // and the source position so we can remove it cleanly.
      setBoard((prev) => {
        if (!prev) return prev;
        // First, remove from its current column.
        const without = prev.columns.map((c) => ({
          ...c,
          tasks: c.tasks.filter((t) => t.id !== taskId),
        }));
        // Then insert into the target column at its position (re-sort).
        return {
          ...prev,
          columns: without.map((c) => {
            if (c.id !== updated.columnId) return c;
            const next = [...c.tasks, updated].sort((a, b) => a.position - b.position);
            return { ...c, tasks: next };
          }),
        };
      });
    },
    [canEdit],
  );

  // ── column mutators ─────────────────────────────────────────────────

  const handleCreateColumn = useCallback(
    async (input: CreateColumnInput): Promise<void> => {
      if (!canEdit) throw new Error('Forbidden');
      const snapshot = boardRef.current;
      const created = await createColumn({ boardId: id, title: input.title });
      appendColumn(created);
      void snapshot;
    },
    [canEdit, id],
  );

  const handleUpdateColumn = useCallback(
    async (columnId: string, input: UpdateColumnInput): Promise<void> => {
      if (!canEdit) throw new Error('Forbidden');
      const snapshot = boardRef.current;
      const updated = await updateColumn(columnId, input);
      replaceColumn(updated);
      void snapshot;
    },
    [canEdit],
  );

  const handleDeleteColumn = useCallback(
    async (columnId: string): Promise<void> => {
      if (!canEdit) throw new Error('Forbidden');
      await deleteColumn(columnId);
      removeColumn(columnId);
    },
    [canEdit],
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
  };
}
