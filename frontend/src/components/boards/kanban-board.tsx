'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api';
import type { BoardColumn, BoardMemberView, BoardTask } from '@/lib/types';
import { useBoardData, type UseBoardDataResult } from '@/hooks/use-board-data';
import { AddColumnForm } from './add-column-form';
import { BoardSkeleton } from './board-skeleton';
import { CreateTaskDialog, type CreateTaskFormValues } from './create-task-dialog';
import { KanbanColumn, KanbanColumnOverlay } from './kanban-column';
import { TaskCardOverlay } from './task-card';
import { TaskDetailDialog, type TaskEditValues } from './task-detail-dialog';

export interface KanbanBoardProps {
  boardId?: string;
  data?: UseBoardDataResult;
}

/**
 * Top-level board view. Owns the DnD context, dialog state, and the bridge
 * between optimistic UI mutations and `useBoardData`. The kanban components
 * inside stay pure presentational.
 */
export function KanbanBoard({ boardId, data }: KanbanBoardProps) {
  const internalData = useBoardData(data ? '' : (boardId ?? ''));
  const {
    board,
    loading,
    error,
    canEdit,
    refresh,
    handleCreateTask,
    handleUpdateTask,
    handleDeleteTask,
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
  } = data ?? internalData;

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
  // Only what the DragOverlay needs. The board itself is reordered live by the
  // hook's preview calls, so there is no separate "pending move" state to keep
  // in sync with it.
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [activeColumn, setActiveColumn] = useState<BoardColumn | null>(null);

  const columns = useMemo(() => board?.columns ?? [], [board]);
  const members: BoardMemberView[] = useMemo(() => board?.members ?? [], [board]);
  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);
  const boardLabels = useMemo(() => board?.labels ?? [], [board]);

  // ── DnD handlers ──────────────────────────────────────────────────
  //
  // The board reorders *during* the drag rather than at drop: `onDragOver`
  // pushes a local-only preview into `useBoardData`, so a gap opens under the
  // cursor and the card follows it across columns. `onDragEnd` then persists
  // wherever the preview left it, which means the request always matches what
  // the user was looking at.

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current;
      if (data?.type === 'task') {
        setActiveTask(data.task as BoardTask);
        beginDrag();
      } else if (data?.type === 'column') {
        setActiveColumn(data.column as BoardColumn);
        beginDrag();
      }
    },
    [beginDrag],
  );

  /**
   * Resolve whatever dnd-kit reports as `over` into "which column, and above
   * which task".
   *
   * Three different droppables overlap in this board: each task, each column's
   * empty-space dropzone, and — since columns became draggable — the column
   * shell itself. Collision detection can legitimately return any of them, so
   * every case has to map back to a column. Missing the `column` case is what
   * made cross-column previews silently do nothing: the pointer was over a
   * column shell, no branch matched, and no preview fired.
   */
  const resolveDropTarget = useCallback(
    (overData: Record<string, unknown> | undefined, overId: string) => {
      if (!overData) return null;
      switch (overData.type) {
        case 'task': {
          const overTask = overData.task as BoardTask;
          return { columnId: overTask.columnId, overTaskId: overTask.id };
        }
        case 'column-dropzone':
          return { columnId: overData.columnId as string, overTaskId: null };
        case 'column':
          return { columnId: overId, overTaskId: null };
        default:
          return null;
      }
    },
    [],
  );

  /**
   * Which half of the hovered card is the pointer past?
   *
   * Without this a card can only ever insert *above* what it hovers, so
   * dragging downwards feels like it lags one slot behind the cursor.
   */
  const withPlacement = useCallback(
    (
      target: { columnId: string; overTaskId: string | null },
      active: DragOverEvent['active'],
      over: NonNullable<DragOverEvent['over']>,
    ) => {
      if (!target.overTaskId) return target;
      const activeRect = active.rect.current.translated;
      const placement =
        activeRect && activeRect.top > over.rect.top + over.rect.height / 2 ? 'after' : 'before';
      return { ...target, placement } as const;
    },
    [],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeData = active.data.current;
      if (!activeData) return;

      const target = resolveDropTarget(over.data.current, over.id as string);
      if (!target) return;

      // ── dragging a column ──
      if (activeData.type === 'column') {
        // Hovering a task or dropzone inside another column still means
        // "put me where that column is".
        if (target.columnId === active.id) return;
        previewColumnMove(active.id as string, target.columnId);
        return;
      }

      if (activeData.type !== 'task') return;

      // ── dragging a task ──
      previewTaskMove(active.id as string, withPlacement(target, active, over));
    },
    [previewColumnMove, previewTaskMove, resolveDropTarget, withPlacement],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const activeData = event.active.data.current;
      const wasColumn = activeData?.type === 'column';
      const taskId = event.active.id as string;

      setActiveTask(null);
      setActiveColumn(null);

      try {
        if (wasColumn) {
          await commitColumnDrag();
        } else {
          // Resolve the release point the same way a hover does, so a
          // within-column reorder — which is never previewed — lands exactly
          // where the sortable strategy has been showing the gap.
          const over = event.over;
          const target = over ? resolveDropTarget(over.data.current, over.id as string) : null;
          await commitTaskDrag(
            taskId,
            target && over ? withPlacement(target, event.active, over) : null,
          );
        }
      } catch (e) {
        // The hook already restored the pre-drag snapshot; a refetch here would
        // just make the card jump a second time.
        const fallback = wasColumn ? 'Could not reorder columns' : 'Could not move task';
        toast.error(e instanceof ApiClientError ? e.message : fallback);
      }
    },
    [commitColumnDrag, commitTaskDrag, resolveDropTarget, withPlacement],
  );

  const handleDragCancel = useCallback(() => {
    setActiveTask(null);
    setActiveColumn(null);
    cancelDrag();
  }, [cancelDrag]);

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
        priority: values.priority,
        dueDate: values.dueDate,
        labelIds: values.labelIds,
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
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex flex-1 items-start gap-3 overflow-x-auto pb-4">
          <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
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
          </SortableContext>
          {canEdit && <AddColumnForm onCreate={handleCreateColumnSubmit} />}
        </div>

        {/*
          `dropAnimation={null}` on purpose. With the live preview the card is
          already sitting in its final slot by the time the pointer is released,
          so animating the overlay back would render the same card twice and
          read as a double move.
        */}
        <DragOverlay dropAnimation={null}>
          {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
          {activeColumn ? <KanbanColumnOverlay column={activeColumn} /> : null}
        </DragOverlay>
      </DndContext>

      {createForColumn && (
        <CreateTaskDialog
          open={!!createForColumn}
          onOpenChange={(open) => !open && setCreateForColumn(null)}
          columnId={createForColumn.columnId}
          columnTitle={createForColumn.columnTitle}
          members={members}
          boardId={board.id}
          boardLabels={boardLabels}
          onLabelCreated={addLabel}
          onCreate={handleCreateTaskSubmit}
        />
      )}

      <TaskDetailDialog
        open={!!openTask}
        onOpenChange={handleCloseTask}
        task={openTask}
        members={members}
        boardId={board.id}
        boardLabels={boardLabels}
        onLabelCreated={addLabel}
        canEdit={canEdit}
        onSave={handleSaveTask}
        onDelete={handleDeleteTaskFromDialog}
      />
    </div>
  );
}
