'use client';

import { forwardRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { BoardTask } from '@/lib/types';

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
        'group/task flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm transition-shadow hover:shadow-md',
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
      aria-label={`Open task ${task.title}`}
    >
      <p className="line-clamp-2 text-sm font-medium leading-snug">{task.title}</p>
      {task.description && (
        <p className="line-clamp-1 text-xs text-muted-foreground">{task.description}</p>
      )}
      {task.assignee && (
        <div className="mt-0.5 flex items-center gap-1.5">
          <Avatar size="sm">
            <AvatarFallback>{initials(task.assignee.name)}</AvatarFallback>
          </Avatar>
          <span className="truncate text-xs text-muted-foreground">{task.assignee.name}</span>
        </div>
      )}
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
        className="flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-lg ring-2 ring-primary/20 rotate-1 opacity-90"
      >
        <p className="line-clamp-2 text-sm font-medium leading-snug">{task.title}</p>
        {task.description && (
          <p className="line-clamp-1 text-xs text-muted-foreground">{task.description}</p>
        )}
        {task.assignee && (
          <div className="mt-0.5 flex items-center gap-1.5">
            <Avatar size="sm">
              <AvatarFallback>{initials(task.assignee.name)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-muted-foreground">{task.assignee.name}</span>
          </div>
        )}
      </Card>
    );
  },
);
