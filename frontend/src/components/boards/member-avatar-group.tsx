'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { BoardMemberView } from '@/lib/types';

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Who has access to this board — distinct from PresenceBar, which shows who is
 * looking at it right now.
 *
 * Lifted out of board-header.tsx so the board bar can render it without
 * importing the old header.
 */
export function MemberAvatarGroup({
  members,
  overflow,
}: {
  members: BoardMemberView[];
  overflow: number;
}) {
  return (
    <div className="hidden items-center md:flex">
      <div className="flex -space-x-2">
        {members.map((m) => (
          <Tooltip key={m.userId}>
            <TooltipTrigger asChild>
              <Avatar size="sm" className="ring-2 ring-background">
                <AvatarFallback>{initials(m.name)}</AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                <span className="font-medium">{m.name}</span>
                <span className="ml-1.5 text-muted-foreground">({m.role.toLowerCase()})</span>
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-2 ring-background">
                +{overflow}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {overflow} more member{overflow === 1 ? '' : 's'}
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
