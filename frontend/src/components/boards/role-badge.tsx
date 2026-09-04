import { cn } from '@/lib/utils';
import type { BoardRole } from '@/lib/types';

const STYLES: Record<BoardRole, string> = {
  OWNER: 'bg-kanban-owner text-kanban-owner-foreground',
  EDITOR: 'bg-kanban-editor text-kanban-editor-foreground',
  VIEWER: 'bg-kanban-viewer text-kanban-viewer-foreground',
};

const LABELS: Record<BoardRole, string> = {
  OWNER: 'Owner',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
};

export function RoleBadge({ role, className }: { role: BoardRole; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide',
        STYLES[role],
        className,
      )}
    >
      {LABELS[role]}
    </span>
  );
}
