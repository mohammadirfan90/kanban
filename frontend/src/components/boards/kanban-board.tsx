'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api';
import type { Board, BoardMemberView, BoardTask } from '@/lib/types';
import { useBoardData } from '@/hooks/use-board-data';
import { AddColumnForm } from './add-column-form';
import { BoardSkeleton } from './board-skeleton';
import { CreateTaskDialog, type CreateTaskFormValues } from './create-task-dialog';
import { KanbanColumn } from './kanban-column';
import { TaskCardOverlay } from './task-card';
import { TaskDetailDialog, type TaskEditValues } from './task-detail-dialog';

export interface KanbanBoardProps {
  boardId: string;
}

/**
 * Top-level board view. Owns the DnD context, dialog state, and the bridge
 * between optimistic UI mutations and `useBoardData`. The kanban components
 * inside stay pure presentational.
 */
export function KanbanBoard({ boardId }: KanbanBoardProps) {
  const {
    board,
    loading,
    error,
    canEdit,
    refresh,
    handleCreateTask,
    handleUpdateTask,
    handleDeleteTask,
    handleMoveTask,
    handleCreateColumn,
    handleUpdateColumn,
    handleDeleteColumn,
  } = useBoardData(boardId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 8px activation threshold — a simple click on a card reaches the
      // onClick handler without triggering drag.
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // ── dialog state ──────────────────────────────────────────────────
  const [createForColumn, setCreateForColumn] = useState<{
    columnId: string;
    columnTitle: string;
  } | null>(null);
  const [openTask, setOpenTask] = useState<BoardTask | null>(null);

  // ── DnD state ─────────────────────────────────────────────────────
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  // Snapshot of `board` taken at drag-start; restored on move failure.
  const snapshotRef = useRef<Board | null>(null);

  const columns = useMemo(() => board?.columns ?? [], [board]);
  const members: BoardMemberView[] = useMemo(() => board?.members ?? [], [board]);

  // ── DnD handlers ──────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === 'task') {
      setActiveTask(data.task as BoardTask);
      snapshotRef.current = board;
    }
  }, [board]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);
      const snapshot = snapshotRef.current;
      snapshotRef.current = null;
      if (!over || !snapshot) return;

      const activeData = active.data.current;
      if (activeData?.type !== 'task') return;
      const task = activeData.task as BoardTask;

      const overData = over.data.current;
      if (!overData) return;

      // Resolve the target column + index.
      let targetColumnId: string;
      let newIndex: number;

      if (overData.type === 'column') {
        // Dropped onto an empty column or below the last task.
        targetColumnId = overData.columnId as string;
        const targetCol = snapshot.columns.find((c) => c.id === targetColumnId);
        newIndex = targetCol ? targetCol.tasks.length : 0;
        // If the task was already last in this column, no-op.
        if (
          task.columnId === targetColumnId &&
          targetCol &&
          newIndex - 1 === targetCol.tasks.findIndex((t) => t.id === task.id)
        ) {
          return;
        }
      } else if (overData.type === 'task') {
        const overTask = overData.task as BoardTask;
        targetColumnId = overTask.columnId;
        const targetCol = snapshot.columns.find((c) => c.id === targetColumnId);
        if (!targetCol) return;
        const overIndex = targetCol.tasks.findIndex((t) => t.id === overTask.id);
        if (overIndex < 0) return;
        newIndex = overIndex;

        // If we're moving within the same column and ending up at our own
        // slot, it's a no-op.
        if (task.columnId === targetColumnId) {
          const fromIndex = targetCol.tasks.findIndex((t) => t.id === task.id);
          if (fromIndex === newIndex || fromIndex + 1 === newIndex) {
            return;
          }
          // Adjust: dragging forward in the same column means the index
          // we want is the slot we're hovering (the task we're above).
          // dnd-kit already gives us "over" as the task we hovered; that's
          // the index to insert at. The server inserts BEFORE the over task
          // when newIndex === overIndex.
          if (fromIndex < newIndex) newIndex = newIndex; // already correct
        }
      } else {
        return;
      }

      try {
        await handleMoveTask(task.id, { targetColumnId, newIndex });
      } catch (e) {
        const msg = e instanceof ApiClientError ? e.message : 'Could not move task';
        toast.error(msg);
        await refresh();
      }
    },
    [handleMoveTask, refresh],
  );

  const handleDragCancel = useCallback(() => {
    setActiveTask(null);
    snapshotRef.current = null;
  }, []);

  // ── task dialog handlers ──────────────────────────────────────────

  const handleOpenTask = useCallback((task: BoardTask) => {
    setOpenTask(task);
  }, []);

  const handleCloseTask = useCallback((open: boolean) => {
    if (!open) setOpenTask(null);
  }, []);

  const handleSaveTask = useCallback(
    async (taskId: string, values: TaskEditValues) => {
      await handleUpdateTask(taskId, {
        title: values.title,
        description: values.description ?? undefined,
        assigneeId: values.assigneeId,
      });
    },
    [handleUpdateTask],
  );

  const handleDeleteTaskFromDialog = useCallback(
    async (taskId: string) => {
      await handleDeleteTask(taskId);
    },
    [handleDeleteTask],
  );

  // ── column menu handlers ──────────────────────────────────────────

  const handleRenameColumn = useCallback(
    async (columnId: string, title: string) => {
      await handleUpdateColumn(columnId, { title });
    },
    [handleUpdateColumn],
  );

  const onColumnMenuDelete = useCallback(
    async (columnId: string) => {
      await handleDeleteColumn(columnId);
    },
    [handleDeleteColumn],
  );

  // ── inline-add-task (no dialog) ──────────────────────────────────

  const handleInlineCreateTask = useCallback(
    async (columnId: string, title: string) => {
      await handleCreateTask(columnId, { columnId, title });
    },
    [handleCreateTask],
  );

  // ── column-create (form) ─────────────────────────────────────────

  const handleCreateColumnSubmit = useCallback(
    async (title: string) => {
      await handleCreateColumn({ title });
      toast.success(`Added "${title}"`);
    },
    [handleCreateColumn],
  );

  // ── dialog (full form) ────────────────────────────────────────────

  const handleCreateTaskSubmit = useCallback(
    async (columnId: string, values: CreateTaskFormValues) => {
      await handleCreateTask(columnId, { ...values, columnId });
    },
    [handleCreateTask],
  );

  const openDialogFor = useCallback((columnId: string) => {
    const col = columns.find((c) => c.id === columnId);
    if (!col) return;
    setCreateForColumn({ columnId, columnTitle: col.title });
  }, [columns]);

  // ── render branches ──────────────────────────────────────────────

  if (loading && !board) {
    return <BoardSkeleton />;
  }

  if (error || !board) {
    return (
      <div className="mx-auto max-w-md rounded-md border border-destructive/40 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">{error?.message ?? 'Could not load board'}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory lg:flex-nowrap">
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              canEdit={canEdit}
              isLastColumn={columns.length === 1}
              onAddTask={openDialogFor}
              onOpenTask={handleOpenTask}
              onCreateTaskInline={handleInlineCreateTask}
              onRenameColumn={handleRenameColumn}
              onDeleteColumn={onColumnMenuDelete}
            />
          ))}
          {canEdit && <AddColumnForm onCreate={handleCreateColumnSubmit} />}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      {createForColumn && (
        <CreateTaskDialog
          open={!!createForColumn}
          onOpenChange={(open) => !open && setCreateForColumn(null)}
          columnId={createForColumn.columnId}
          columnTitle={createForColumn.columnTitle}
          members={members}
          onCreate={handleCreateTaskSubmit}
        />
      )}

      <TaskDetailDialog
        open={!!openTask}
        onOpenChange={handleCloseTask}
        task={openTask}
        members={members}
        canEdit={canEdit}
        onSave={handleSaveTask}
        onDelete={handleDeleteTaskFromDialog}
      />
    </div>
  );
}
