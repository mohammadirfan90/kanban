'use client';

import { useEffect, useRef, useState } from 'react';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Check, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiClientError } from '@/lib/api';
import { EmptyColumn } from './empty-column';
import { ColumnMenu } from './column-menu';
import { TaskCard } from './task-card';
import { cn } from '@/lib/utils';
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
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col gap-2 rounded-lg bg-muted/30 p-3',
        COLUMN_WIDTH,
        'min-h-[200px]',
      )}
      data-testid={`column-${column.id}`}
    >
      <Header
        column={column}
        canEdit={canEdit}
        isLastColumn={isLastColumn}
        onRename={onRenameColumn}
        onDelete={onDeleteColumn}
      />

      <TaskList columnId={column.id} tasks={column.tasks} disabled={!canEdit} onOpenTask={onOpenTask} />

      {canEdit && onCreateTaskInline && (
        <InlineAddTask columnId={column.id} onCreate={onCreateTaskInline} onOpenDialog={() => onAddTask(column.id)} />
      )}

      {!canEdit && column.tasks.length === 0 && (
        <EmptyColumn canAddTask={false} onAddTask={() => undefined} />
      )}
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
}: {
  column: BoardColumn;
  canEdit: boolean;
  isLastColumn: boolean;
  onRename: (columnId: string, title: string) => Promise<void>;
  onDelete: (columnId: string) => Promise<void>;
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
      // eslint-disable-next-line no-alert
      alert(msg);
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
      <h3 className="truncate text-sm font-semibold tracking-tight">{column.title}</h3>
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
  onOpenTask,
}: {
  columnId: string;
  tasks: BoardTask[];
  disabled: boolean;
  onOpenTask: (task: BoardTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${columnId}`, data: { type: 'column', columnId } });
  const taskIds = tasks.map((t) => t.id);

  return (
    <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[40px] flex-1 flex-col gap-2 rounded-md transition-colors',
          isOver && 'bg-accent/40 ring-2 ring-primary/30',
        )}
      >
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} disabled={disabled} onClick={onOpenTask} />
        ))}
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
    return (
      <div className="mt-auto flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => setOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add task
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs text-muted-foreground/70"
          onClick={onOpenDialog}
          title="Open the full task form"
        >
          ✎ Detailed form
        </Button>
      </div>
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
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
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
