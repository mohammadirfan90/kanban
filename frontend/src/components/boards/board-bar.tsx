'use client';

import Link from 'next/link';
import { ArrowLeft, Check, Globe, Image as ImageIcon, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PresenceBar } from './presence-bar';
import { MemberAvatarGroup } from './member-avatar-group';
import { BOARD_BACKGROUNDS } from '@/lib/board-background';
import { updateBoard } from '@/lib/boards';
import { ApiClientError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Board } from '@/lib/types';
import type { PresenceUser } from '@/lib/realtime';

const MAX_AVATARS = 4;

export interface BoardBarProps {
  board: Board;
  presence: PresenceUser[];
  realtimeConnected: boolean;
  currentUserId?: string;
  onShareClick: () => void;
  /** Called with the updated board after a background change. */
  onBoardChange: (board: Board) => void;
}

/**
 * The board's own bar, below the app navbar.
 *
 * Everything here is scoped to one board — its name, who is on it, how it
 * looks. Nothing about the account or the app lives at this level, which is
 * what keeps the navbar above it identical on every page.
 */
export function BoardBar({
  board,
  presence,
  realtimeConnected,
  currentUserId,
  onShareClick,
  onBoardChange,
}: BoardBarProps) {
  const isOwner = board.role === 'OWNER';
  const visible = board.members.slice(0, MAX_AVATARS);
  const overflow = board.members.length - visible.length;

  const setBackground = async (token: string) => {
    // Optimistic: repainting the canvas should feel instant, and the only
    // failure mode is a colour that reverts.
    const previous = board.background;
    onBoardChange({ ...board, background: token || null });
    try {
      const updated = await updateBoard(board.id, { background: token });
      onBoardChange(updated);
    } catch (e) {
      onBoardChange({ ...board, background: previous });
      toast.error(e instanceof ApiClientError ? e.message : 'Could not change the background');
    }
  };

  return (
    <div className="flex h-12 w-full items-center justify-between gap-3 border-b px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Back to boards">
          <Link href="/boards">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="truncate text-sm font-semibold tracking-tight">{board.title}</h1>
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {board.role}
        </Badge>
        {board.isPublic && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="hidden gap-1 sm:inline-flex">
                <Globe className="h-3 w-3" />
                Public
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Anyone with the link can view this board</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <PresenceBar
          users={presence}
          connected={realtimeConnected}
          currentUserId={currentUserId}
        />
        <MemberAvatarGroup members={visible} overflow={overflow} />

        {/* Editors change how the board looks; only owners manage who sees it. */}
        {board.role !== 'VIEWER' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Board background">
                <ImageIcon className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Background</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Background</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="grid grid-cols-5 gap-2 p-2">
                {BOARD_BACKGROUNDS.map((bg) => (
                  <Tooltip key={bg.token}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={bg.label}
                        onClick={() => void setBackground(bg.token)}
                        style={{ background: bg.swatch }}
                        className={cn(
                          'relative h-9 w-full rounded-md border border-black/10 transition-transform hover:scale-105 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                          board.background === bg.token && 'ring-2 ring-primary ring-offset-1',
                        )}
                      >
                        {board.background === bg.token && (
                          <Check className="absolute inset-0 m-auto h-4 w-4 text-slate-900" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{bg.label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <DropdownMenuSeparator />
              <div className="p-2 pt-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => void setBackground('')}
                  disabled={!board.background}
                >
                  Reset to default
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {isOwner && (
          <Button variant="outline" size="sm" onClick={onShareClick}>
            <UserPlus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        )}
      </div>
    </div>
  );
}
