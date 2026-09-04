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
import { BoardHeader } from '@/components/boards/board-header';
import { KanbanBoard } from '@/components/boards/kanban-board';
import { ShareBoardDialog } from '@/components/boards/share-board-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useBoard } from '@/hooks/use-board';
import { ApiClientError } from '@/lib/api';
import { revokeBoardShare } from '@/lib/boards';
import type { BoardMemberView } from '@/lib/types';

export default function BoardDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const boardId = typeof params.id === 'string' ? params.id : '';

  const { board, loading: boardLoading, error, refresh } = useBoard(boardId);

  const [shareOpen, setShareOpen] = useState(false);
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
      {board ? (
        <BoardHeader
          board={board}
          onShareClick={() => setShareOpen(true)}
          onSignOut={() => void logout()}
        />
      ) : (
        <header className="border-b bg-background/80 backdrop-blur-sm">
          <div className="container flex h-16 items-center px-4 sm:px-6 lg:px-8">
            <p className="text-sm text-muted-foreground">
              {boardLoading ? 'Loading board…' : error?.message ?? '…'}
            </p>
          </div>
        </header>
      )}

      <main className="flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <KanbanBoard boardId={boardId} />
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
