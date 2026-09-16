'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { BoardMemberView } from '@/lib/types';
import { UserAvatar } from '@/components/user-avatar';


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
              <UserAvatar name={m.name} avatarUrl={m.avatarUrl} className="ring-2 ring-background" />
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
