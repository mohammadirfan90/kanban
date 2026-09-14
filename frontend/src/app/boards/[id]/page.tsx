'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AppNavbar } from '@/components/app-navbar';
import { BoardBar } from '@/components/boards/board-bar';
import { KanbanBoard } from '@/components/boards/kanban-board';
import { ShareBoardDialog } from '@/components/boards/share-board-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useBoardData } from '@/hooks/use-board-data';
import { ApiClientError } from '@/lib/api';
import { backgroundStyle } from '@/lib/board-background';
import { revokeBoardShare } from '@/lib/boards';
import type { BoardMemberView } from '@/lib/types';

export default function BoardDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const boardId = typeof params.id === 'string' ? params.id : '';

  const boardData = useBoardData(boardId);
  const {
    board,
    loading: boardLoading,
    error,
    refresh,
    presence,
    realtimeConnected,
    applyBoard,
  } = boardData;

  const [shareOpen, setShareOpen] = useState(false);
  /** Board-scoped card filter, driven by the navbar search box. */
  const [query, setQuery] = useState('');
  const [removing, setRemoving] = useState<BoardMemberView | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Auth guard.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  // Surface forbidden/not-found as redirects.
  useEffect(() => {
    if (error?.kind === 'forbidden') {
      toast.error("You don't have access to this board");
      router.replace('/boards');
    } else if (error?.kind === 'not-found') {
      toast.error('Board not found');
      router.replace('/boards');
    }
  }, [error, router]);

  const handleRevoke = async () => {
    if (!removing) return;
    setRevoking(true);
    try {
      await revokeBoardShare(boardId, removing.userId);
      toast.success(`Removed ${removing.name}`);
      setRemoving(null);
      await refresh();
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Could not remove member';
      toast.error(msg);
    } finally {
      setRevoking(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="container flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const isOwner = board?.role === 'OWNER';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* App chrome first, board chrome second — identical on every page. */}
      <AppNavbar
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder="Filter cards on this board"
        onCreateBoard={() => router.push('/boards?create=1')}
      />

      {board ? (
        <BoardBar
          board={board}
          presence={presence}
          realtimeConnected={realtimeConnected}
          currentUserId={user?.id}
          onShareClick={() => setShareOpen(true)}
          onBoardChange={applyBoard}
        />
      ) : (
        <div className="flex h-12 items-center border-b px-3 sm:px-4">
          <p className="text-sm text-muted-foreground">
            {boardLoading ? 'Loading board…' : (error?.message ?? '…')}
          </p>
        </div>
      )}

      {/*
        The canvas, and the only thing that carries the board's background.
        The bars above keep the app surface so the chrome stays legible against
        every palette entry.

        flex + flex-1 the whole way down, not `h-full`: percentage heights are
        fragile through several ancestors, and this is what lets the drop zone
        stretch to fill the viewport instead of collapsing to its content
        height. Full width now — no max-width container — so the board reads as
        a canvas rather than a centred document.
      */}
      <main
        className="board-canvas flex flex-1 flex-col px-3 pb-6 pt-4 sm:px-4"
        style={backgroundStyle(board?.background)}
      >
        <div className="flex w-full flex-1 flex-col">
          <KanbanBoard data={boardData} filter={query} />
        </div>
      </main>

      {isOwner && board && (
        <ShareBoardDialog
          board={board}
          open={shareOpen}
          onOpenChange={setShareOpen}
          onShared={() => void refresh()}
        />
      )}

      {/* Remove-member confirm */}
      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{removing?.name}</strong> ({removing?.email}) will lose access to this
              board immediately. This action cannot be undone — you would need to share the
              board with them again to restore access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleRevoke();
              }}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
