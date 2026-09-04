'use client';

import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface EmptyColumnProps {
  /** When false, hides the "+ Add task" CTA (VIEWER role). */
  canAddTask: boolean;
  onAddTask: () => void;
}

export function EmptyColumn({ canAddTask, onAddTask }: EmptyColumnProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-xs text-muted-foreground">No tasks</p>
      {canAddTask && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddTask}
          className="mt-1 text-xs"
        >
          + Add task
        </Button>
      )}
    </div>
  );
}
