'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { PresenceUser } from '@/lib/realtime';
import { UserAvatar } from '@/components/user-avatar';

const MAX_VISIBLE = 4;


export interface PresenceBarProps {
  users: PresenceUser[];
  /** Hidden entirely while the socket is down, rather than showing a stale list. */
  connected: boolean;
  /** The caller, so they are not shown as another viewer. */
  currentUserId?: string;
}

/**
 * Who else is on this board right now.
 *
 * Presence is ephemeral and never persisted: if the server restarts, everyone
 * simply reappears on reconnect. It is also deliberately hidden when the socket
 * drops — an avatar row that keeps showing people who left is worse than no
 * avatar row, because it claims something untrue.
 */
export function PresenceBar({ users, connected, currentUserId }: PresenceBarProps) {
  const others = users.filter((u) => u.userId !== currentUserId);
  if (!connected || others.length === 0) return null;

  const visible = others.slice(0, MAX_VISIBLE);
  const overflow = others.length - visible.length;

  return (
    <div className="flex items-center gap-2" aria-label={`${others.length} other people viewing`}>
      <span className="relative flex h-2 w-2" title="Live">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <div className="flex -space-x-2">
        {visible.map((user) => (
          <Tooltip key={user.userId}>
            <TooltipTrigger asChild>
              <UserAvatar
                name={user.name}
                avatarUrl={user.avatarUrl}
                className={cn(
                  'ring-2 ring-background transition-shadow',
                  // A ring while they are dragging, so the avatar row and the
                  // highlighted card tell the same story.
                  user.draggingTaskId && 'ring-primary',
                )}
              />
            </TooltipTrigger>
            <TooltipContent>
              {user.name}
              {user.draggingTaskId ? ' — moving a card' : ''}
            </TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 && (
          <Avatar size="sm" className="ring-2 ring-background">
            <AvatarFallback>+{overflow}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
