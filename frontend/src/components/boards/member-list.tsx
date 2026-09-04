'use client';

import { MoreHorizontal, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RoleBadge } from './role-badge';
import type { Board, BoardMemberView, BoardRole } from '@/lib/types';

export interface MemberListProps {
  board: Board;
  currentUserId: string;
  /** Called when the OWNER chooses "Remove" for a non-self member. */
  onRemove: (member: BoardMemberView) => void;
}

/** Two-letter initials derived from a person's name. Falls back to "?" if empty. */
function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function MemberList({ board, currentUserId, onRemove }: MemberListProps) {
  const isOwner = board.role === 'OWNER';
  const canRemove = isOwner;
  const members = board.members;

  if (members.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Only you have access</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="divide-y divide-border">
        {members.map((m) => {
          const isSelf = m.userId === currentUserId;
          const showActions = canRemove && !isSelf;
          return (
            <div
              key={m.userId}
              className="flex items-center gap-3 px-4 py-3 sm:px-6"
              data-testid={`member-row-${m.userId}`}
            >
              <Avatar size="sm">
                <AvatarFallback>{initials(m.name)}</AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  {isSelf && (
                    <span className="text-xs text-muted-foreground">(you)</span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>

              <RoleBadge role={m.role as BoardRole} />

              {showActions && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${m.name}`}
                      title="Actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onRemove(m)}
                    >
                      <Trash2 />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
