'use client';

import Link from 'next/link';
import { ArrowLeft, LogOut, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ModeToggle } from '@/components/mode-toggle';
import { Logo } from '@/components/logo';
import { RoleBadge } from './role-badge';
import type { Board, BoardMemberView, BoardRole } from '@/lib/types';

const MAX_AVATARS = 5;

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface BoardHeaderProps {
  board: Board;
  onShareClick: () => void;
  onSignOut: () => void;
}

export function BoardHeader({ board, onShareClick, onSignOut }: BoardHeaderProps) {
  const isOwner = board.role === 'OWNER';
  const visible = board.members.slice(0, MAX_AVATARS);
  const overflow = board.members.length - visible.length;

  return (
    <header className="border-b bg-background/80 backdrop-blur-xs">
      <div className="container flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/boards"
            aria-label="Back to boards"
            title="Back to boards"
            className="-ml-2 inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo href="/boards" className="hidden sm:flex" />
          <span className="hidden text-muted-foreground sm:inline">/</span>
          <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
            {board.title}
          </h1>
          <RoleBadge role={board.role as BoardRole} className="hidden sm:inline-flex" />
        </div>

        <div className="flex items-center gap-3">
          <MemberAvatarGroup members={visible} overflow={overflow} />
          {isOwner && (
            <Button variant="outline" size="sm" onClick={onShareClick}>
              <UserPlus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
              <span className="sm:hidden">Share</span>
            </Button>
          )}
          <ModeToggle />
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

function MemberAvatarGroup({
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
              <p className="text-xs">{overflow} more member{overflow === 1 ? '' : 's'}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
