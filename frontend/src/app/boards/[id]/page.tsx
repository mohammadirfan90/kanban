'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Columns,
  KanbanSquare,
  Loader2,
  LogOut,
  Share2,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { ModeToggle } from '@/components/mode-toggle';
import { MemberList } from '@/components/boards/member-list';
import { ShareBoardDialog } from '@/components/boards/share-board-dialog';
import { RoleBadge } from '@/components/boards/role-badge';
import { useBoard } from '@/hooks/use-board';
import { useAuth } from '@/contexts/AuthContext';
import { ApiClientError } from '@/lib/api';
import { revokeBoardShare } from '@/lib/boards';
import type { Board, BoardMemberView, BoardRole } from '@/lib/types';

export default function BoardDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const boardId = typeof params.id === 'string' ? params.id : '';

  const { board, loading, error, refresh } = useBoard(boardId);

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
      await revokeBoardShare(board!.id, removing.userId);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader user={user} logout={logout} board={null} onShareClick={() => undefined} />
        <main className="container px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-48 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader user={user} logout={logout} board={null} onShareClick={() => undefined} />
        <main className="container px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-md text-center">
            <p className="text-sm text-destructive">{error?.message ?? 'Could not load board'}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void refresh()}
            >
              Retry
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const isOwner = board.role === 'OWNER';

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        user={user}
        logout={logout}
        board={board}
        onShareClick={() => setShareOpen(true)}
      />

      <main className="container px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Board header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <h1 className="truncate text-2xl font-semibold tracking-tight">{board.title}</h1>
                <RoleBadge role={board.role as BoardRole} />
              </div>
              {board.description && (
                <p className="mt-2 text-sm text-muted-foreground">{board.description}</p>
              )}
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {board.members.length} {board.members.length === 1 ? 'member' : 'members'}
              </p>
            </div>
          </div>

          {/* Member panel */}
          <section className="mt-10">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                <Users className="h-4 w-4" />
                Members
              </h2>
              {isOwner && (
                <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Share
                </Button>
              )}
            </div>
            <MemberList
              board={board}
              currentUserId={user.id}
              onRemove={(m) => setRemoving(m)}
            />
          </section>

          {/* Columns placeholder (Spec 10 will wire drag-drop here) */}
          <section className="mt-10">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                <Columns className="h-4 w-4" />
                Columns
              </h2>
            </div>
            <ColumnsPlaceholder board={board} />
          </section>
        </div>
      </main>

      {/* Share dialog */}
      {isOwner && (
        <ShareBoardDialog
          board={board}
          open={shareOpen}
          onOpenChange={setShareOpen}
          onShared={() => {
            setShareOpen(false);
            void refresh();
          }}
        />
      )}

      {/* Remove confirmation */}
      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{removing?.name}</strong> ({removing?.email}) will lose access to this board
              immediately. This action cannot be undone — you would need to share the board with
              them again to restore access.
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

function PageHeader({
  user,
  logout,
  board,
  onShareClick,
}: {
  user: { name: string | null; email: string };
  logout: () => Promise<void>;
  board: Board | null;
  onShareClick: () => void;
}) {
  const isOwner = board?.role === 'OWNER';
  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/boards" className="flex items-center gap-2 font-semibold tracking-tight">
            <KanbanSquare className="h-5 w-5" />
            <span>Kanban</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="truncate text-sm text-muted-foreground">
            {board ? board.title : '…'}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {isOwner && board && (
            <Button variant="outline" size="sm" onClick={onShareClick} className="hidden sm:inline-flex">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          )}
          <span className="hidden text-sm text-muted-foreground md:inline">
            {user.name ?? user.email}
          </span>
          <ModeToggle />
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}

/**
 * Read-only column + task list for Spec 09. Spec 10 (drag-drop) will
 * replace this with the dnd-kit-powered Kanban board view.
 */
function ColumnsPlaceholder({ board }: { board: Board }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {board.columns.map((col) => (
        <Card key={col.id} className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight">{col.title}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
              {col.tasks.length}
            </span>
          </div>
          {col.tasks.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground/70">No tasks yet</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {col.tasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-xs"
                >
                  <span className="truncate">{t.title}</span>
                  {t.assignee && (
                    <span
                      className="ml-2 truncate text-muted-foreground"
                      title={t.assignee.email}
                    >
                      @{t.assignee.name}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
      {board.columns.length === 0 && (
        <Card className="col-span-full p-8 text-center">
          <p className="text-sm text-muted-foreground">No columns</p>
        </Card>
      )}
    </div>
  );
}
