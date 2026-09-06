'use client';

import { forwardRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { isOptimisticId } from '@/hooks/use-board-data';
import { cn } from '@/lib/utils';
import type { BoardTask } from '@/lib/types';
import { DueDate, LabelChip, PriorityIndicator } from './task-meta';

export interface TaskCardProps {
  task: BoardTask;
  /** Disables drag (VIEWER mode). */
  disabled?: boolean;
  onClick?: (task: BoardTask) => void;
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Everything inside a task card, shared by the sortable card and the drag
 * overlay. They rendered the same markup twice before, which is how the
 * overlay ends up missing whatever the card gains next.
 */
function TaskCardBody({ task }: { task: BoardTask }) {
  // The key is server-assigned, so an optimistic card has none yet.
  const showKey = !isOptimisticId(task.id);

  return (
    <>
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
        </div>
      )}

      <p className="line-clamp-2 text-sm font-medium leading-snug">{task.title}</p>

      {task.description && (
        <p className="line-clamp-1 text-xs text-muted-foreground">{task.description}</p>
      )}

      {/*
        One metadata row rather than a row per field. The key, priority and due
        date all read as "about this task" and each costs a line of card height
        if given its own — on a column of eight cards that is most of a screen.
      */}
      {(showKey || task.priority || task.dueDate || task.assignee) && (
        <div className="flex items-center gap-2">
          {showKey && (
            <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground/70 tabular-nums">
              {task.key}
            </span>
          )}
          {task.priority && <PriorityIndicator priority={task.priority} />}
          {task.dueDate && <DueDate dueDate={task.dueDate} />}
          {task.assignee && (
            <Avatar size="sm" className="ml-auto">
              <AvatarFallback>{initials(task.assignee.name)}</AvatarFallback>
            </Avatar>
          )}
        </div>
      )}
    </>
  );
}

/**
 * A draggable card representing a single task. Uses dnd-kit's `useSortable`
 * hook; while dragging the parent handles transform application.
 *
 * The card itself stays in place during drag — the `DragOverlay` renders the
 * rotated copy visually.
 */
export function TaskCard({ task, disabled, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'task', task },
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      data-dragging={isDragging || undefined}
      className={cn(
        'group/task flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-xs transition-shadow hover:shadow-sm',
        isDragging && 'opacity-40',
        disabled && 'cursor-default',
      )}
      {...attributes}
      {...listeners}
      onClick={() => onClick?.(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onClick?.(task);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open task ${task.key ? `${task.key} ` : ''}${task.title}`}
    >
      <TaskCardBody task={task} />
    </Card>
  );
}

/**
 * A non-interactive variant of TaskCard used for the `<DragOverlay>`.
 * Receives the same shape but renders without sortable listeners.
 */
export const TaskCardOverlay = forwardRef<HTMLDivElement, { task: BoardTask }>(
  function TaskCardOverlay({ task }, ref) {
    return (
      <Card
        ref={ref}
        className="flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-md ring-2 ring-primary/20 rotate-1 opacity-90"
      >
        <TaskCardBody task={task} />
      </Card>
    );
  },
);
