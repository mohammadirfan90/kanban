'use client';

import { useEffect, useRef, useState } from 'react';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { Check, GripVertical, ListPlus, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiClientError } from '@/lib/api';
import { EmptyColumn } from './empty-column';
import { ColumnMenu } from './column-menu';
import { TaskCard } from './task-card';
import { cn } from '@/lib/utils';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { BoardColumn, BoardTask } from '@/lib/types';

const COLUMN_WIDTH = 'w-80'; // 320px per DESIGN.md

export interface KanbanColumnProps {
  column: BoardColumn;
  canEdit: boolean;
  isLastColumn: boolean;
  onAddTask: (columnId: string) => void;
  onOpenTask: (task: BoardTask) => void;
  onCreateTaskInline?: (columnId: string, title: string) => Promise<void>;
  onRenameColumn: (columnId: string, title: string) => Promise<void>;
  onDeleteColumn: (columnId: string) => Promise<void>;
}

export function KanbanColumn({
  column,
  canEdit,
  isLastColumn,
  onAddTask,
  onOpenTask,
  onCreateTaskInline,
  onRenameColumn,
  onDeleteColumn,
}: KanbanColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'column', column },
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex max-h-full min-h-48 shrink-0 flex-col gap-2 rounded-lg bg-muted/30 p-3',
        COLUMN_WIDTH,
        // The original stays in place as a hollow slot while the DragOverlay
        // renders the copy that follows the cursor.
        isDragging && 'opacity-40',
      )}
      data-testid={`column-${column.id}`}
      {...attributes}
    >
      <Header
        column={column}
        canEdit={canEdit}
        isLastColumn={isLastColumn}
        onRename={onRenameColumn}
        onDelete={onDeleteColumn}
        dragHandleProps={listeners}
      />

      <TaskList
        columnId={column.id}
        tasks={column.tasks}
        disabled={!canEdit}
        canEdit={canEdit}
        onOpenTask={onOpenTask}
      />

      {canEdit && onCreateTaskInline && (
        <InlineAddTask columnId={column.id} onCreate={onCreateTaskInline} onOpenDialog={() => onAddTask(column.id)} />
      )}
    </div>
  );
}

/**
 * Static copy of a column for the `<DragOverlay>`. Rendering the sortable
 * component there would register a second node under the same id.
 */
export function KanbanColumnOverlay({ column }: { column: BoardColumn }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg bg-muted/60 p-3 shadow-md ring-2 ring-primary/20',
        COLUMN_WIDTH,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-semibold tracking-tight">{column.title}</h3>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-medium text-secondary-foreground tabular-nums">
          {column.tasks.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {column.tasks.slice(0, 3).map((t) => (
          <div key={t.id} className="rounded-lg border border-border bg-card p-3">
            <p className="line-clamp-2 text-sm font-medium leading-snug">{t.title}</p>
          </div>
        ))}
        {column.tasks.length > 3 && (
          <p className="px-1 text-xs text-muted-foreground">
            +{column.tasks.length - 3} more
          </p>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Header
// ────────────────────────────────────────────────────────────────────────

function Header({
  column,
  canEdit,
  isLastColumn,
  onRename,
  onDelete,
  dragHandleProps,
}: {
  column: BoardColumn;
  canEdit: boolean;
  isLastColumn: boolean;
  onRename: (columnId: string, title: string) => Promise<void>;
  onDelete: (columnId: string) => Promise<void>;
  dragHandleProps?: SyntheticListenerMap;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(column.title);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep draft in sync when the column title changes externally.
  useEffect(() => {
    if (!renaming) setDraft(column.title);
  }, [column.title, renaming]);

  // Focus the input when entering rename mode.
  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  const startRename = () => {
    setDraft(column.title);
    setRenaming(true);
  };

  const cancel = () => {
    setDraft(column.title);
    setRenaming(false);
  };

  const submit = async () => {
    const next = draft.trim();
    if (next.length === 0 || next === column.title) {
      cancel();
      return;
    }
    setBusy(true);
    try {
      await onRename(column.id, next);
      setRenaming(false);
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Could not rename column';
      toast.error(msg);
      setDraft(column.title);
      setRenaming(false);
    } finally {
      setBusy(false);
    }
  };

  if (renaming) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          ref={inputRef}
          value={draft}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
            if (e.key === 'Escape') cancel();
          }}
          className="h-7 px-2 text-sm font-semibold"
          maxLength={100}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void submit()}
          disabled={busy}
          aria-label="Confirm rename"
          title="Save"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={cancel}
          disabled={busy}
          aria-label="Cancel rename"
          title="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1">
        {/*
          A dedicated handle, not the whole header. The column body contains
          draggable task cards, so making the entire column its own drag
          surface would make every task drag ambiguous.
        */}
        {canEdit && (
          <button
            type="button"
            className="-ml-1 cursor-grab touch-none rounded-md p-0.5 text-muted-foreground/50 transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            aria-label={`Reorder ${column.title} column`}
            title="Drag to reorder"
            {...dragHandleProps}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <h3 className="truncate text-sm font-semibold tracking-tight">{column.title}</h3>
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-medium text-secondary-foreground tabular-nums">
          {column.tasks.length}
        </span>
        {canEdit && (
          <ColumnMenu
            columnId={column.id}
            columnTitle={column.title}
            isLastColumn={isLastColumn}
            onRename={startRename}
            onDelete={onDelete}
          />
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// TaskList (droppable when empty, sortable when not)
// ────────────────────────────────────────────────────────────────────────

function TaskList({
  columnId,
  tasks,
  disabled,
  canEdit,
  onOpenTask,
}: {
  columnId: string;
  tasks: BoardTask[];
  disabled: boolean;
  canEdit: boolean;
  onOpenTask: (task: BoardTask) => void;
}) {
  // `column-dropzone`, not `column`: the column shell itself is now a sortable
  // with type `column`, and the drag handlers key off these type tags.
  const { setNodeRef, isOver } = useDroppable({
    id: `column-dropzone-${columnId}`,
    data: { type: 'column-dropzone', columnId },
  });
  const taskIds = tasks.map((t) => t.id);

  return (
    <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-md transition-colors',
          isOver && 'bg-accent/40 ring-2 ring-primary/30',
        )}
      >
        {/*
          The empty state lives inside the droppable so an empty column stays a
          full-height drop target. It is rendered for editors too — it used to be
          viewer-only, which left the people who can actually drag aiming at a
          40px strip.
        */}
        {tasks.length === 0 ? (
          <EmptyColumn canDrop={canEdit} />
        ) : (
          tasks.map((t) => (
            <TaskCard key={t.id} task={t} disabled={disabled} onClick={onOpenTask} />
          ))
        )}
      </div>
    </SortableContext>
  );
}

// ────────────────────────────────────────────────────────────────────────
// InlineAddTask — a single-line "Add task" prompt that creates on Enter.
// Distinct from the full CreateTaskDialog (which has description + assignee).
// ────────────────────────────────────────────────────────────────────────

function InlineAddTask({
  columnId,
  onCreate,
  onOpenDialog,
}: {
  columnId: string;
  onCreate: (columnId: string, title: string) => Promise<void>;
  onOpenDialog: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = async () => {
    const trimmed = title.trim();
    if (trimmed.length === 0) return;
    setBusy(true);
    try {
      await onCreate(columnId, trimmed);
      setTitle('');
      // Stay open for rapid entry; user presses Escape or clicks outside to dismiss.
    } catch {
      // The hook has already toasted; keep the field open so user can retry.
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  if (!open) {
    // One affordance, not two. The full form is reachable from the expanded
    // state, so the resting column shows a single quiet action.
    return (
      <Button
        variant="ghost"
        size="sm"
        className="mt-auto w-full justify-start text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add task
      </Button>
    );
  }

  return (
    <div className="mt-auto flex items-center gap-1.5">
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
          if (e.key === 'Escape') {
            setTitle('');
            setOpen(false);
          }
        }}
        placeholder="Task title"
        maxLength={200}
        disabled={busy}
        className="h-8 text-sm"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => void submit()}
        disabled={busy || title.trim().length === 0}
        aria-label="Add task"
        title="Add task"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onOpenDialog}
        disabled={busy}
        aria-label="Add task with description and assignee"
        title="More options"
      >
        <ListPlus className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => {
          setTitle('');
          setOpen(false);
        }}
        disabled={busy}
        aria-label="Cancel"
        title="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
