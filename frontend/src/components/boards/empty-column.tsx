'use client';

import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyColumnProps {
  /**
   * Editors get a dashed drop target; viewers get a plain empty state.
   *
   * There is deliberately no "Add task" button here any more — the column
   * already renders `InlineAddTask` directly below, and two add affordances a
   * few pixels apart read as a mistake.
   */
  canDrop: boolean;
}

export function EmptyColumn({ canDrop }: EmptyColumnProps) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-2 rounded-md py-8 text-center',
        canDrop && 'border border-dashed border-border',
      )}
    >
      <Inbox className="h-8 w-8 text-muted-foreground/40" aria-hidden />
      <p className="text-xs text-muted-foreground">{canDrop ? 'Drop tasks here' : 'No tasks'}</p>
    </div>
  );
}
