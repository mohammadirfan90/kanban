'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  KanbanSquare,
  LogOut,
  Plus,
  Inbox,
  Pencil,
  Trash2,
  Users,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Skeleton } from '@/components/ui/skeleton';
import { ModeToggle } from '@/components/mode-toggle';
import { BoardForm } from '@/components/boards/board-form';
import { RoleBadge } from '@/components/boards/role-badge';
import { useAuth } from '@/contexts/AuthContext';
import { ApiClientError } from '@/lib/api';
import { listBoards, deleteBoard } from '@/lib/boards';
import type { Board } from '@/lib/types';

export default function BoardsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [boards, setBoards] = useState<Board[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Board | null>(null);
  const [deleting, setDeleting] = useState<Board | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  // Auth guard: once we know we're not loading and there's no user, redirect to login.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  const loadBoards = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await listBoards();
      setBoards(data);
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Could not load boards';
      setLoadError(msg);
      toast.error(msg);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void loadBoards();
    }
  }, [user, loadBoards]);

  const handleSaved = (saved: Board) => {
    setBoards((prev) => {
      if (!prev) return [saved];
      const idx = prev.findIndex((b) => b.id === saved.id);
      if (idx === -1) return [saved, ...prev];
      const next = prev.slice();
      next[idx] = saved;
      return next;
    });
    setCreateOpen(false);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteBoard(deleting.id);
      setBoards((prev) => (prev ? prev.filter((b) => b.id !== deleting.id) : prev));
      toast.success(`Deleted "${deleting.title}"`);
      setDeleting(null);
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Could not delete board';
      toast.error(msg);
    } finally {
      setDeletingBusy(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="container flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/boards" className="flex items-center gap-2 font-semibold tracking-tight">
            <KanbanSquare className="h-5 w-5" />
            <span>Kanban</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
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

      <main className="container px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Your boards</h1>
              <p className="mt-1 text-muted-foreground">
                {boards ? (
                  <>
                    {boards.length} {boards.length === 1 ? 'board' : 'boards'} you can access
                  </>
                ) : (
                  'Loading your boards…'
                )}
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New board
            </Button>
          </div>

          <div className="mt-10">
            {boards === null && !loadError ? (
              <BoardsGridSkeleton />
            ) : loadError ? (
              <LoadErrorState message={loadError} onRetry={() => void loadBoards()} />
            ) : boards && boards.length === 0 ? (
              <EmptyBoards onCreate={() => setCreateOpen(true)} />
            ) : (
              <BoardsGrid
                boards={boards ?? []}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
            )}
          </div>
        </div>
      </main>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new board</DialogTitle>
            <DialogDescription>
              We&apos;ll add three default columns (To Do, In Progress, Done) so you can start
              organizing right away.
            </DialogDescription>
          </DialogHeader>
          <BoardForm onSaved={handleSaved} onCancel={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit board</DialogTitle>
            <DialogDescription>
              Update the title and description. Members and columns are managed separately.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <BoardForm
              board={editing}
              onSaved={handleSaved}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete board?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleting?.title}</strong> along with its
              columns, tasks, and member access. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deletingBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BoardsGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="p-6">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-1 h-4 w-1/2" />
          <div className="mt-6 flex justify-between">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function LoadErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <p className="text-sm font-medium text-destructive">{message}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function EmptyBoards({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
      <Inbox className="h-12 w-12 text-muted-foreground/40" />
      <h3 className="mt-4 text-lg font-semibold">No boards yet</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Create your first board to start organizing your work.
      </p>
      <Button className="mt-6" onClick={onCreate}>
        <Plus className="mr-2 h-4 w-4" />
        Create board
      </Button>
    </div>
  );
}

interface BoardsGridProps {
  boards: Board[];
  onEdit: (b: Board) => void;
  onDelete: (b: Board) => void;
}

function BoardsGrid({ boards, onEdit, onDelete }: BoardsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {boards.map((b) => {
        const isOwner = b.role === 'OWNER';
        const taskCount = b.columns.reduce((sum, c) => sum + c.tasks.length, 0);
        const updated = new Date(b.updatedAt);
        // Stop the wrapping <Link> from navigating when an action button is clicked.
        const stop = (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
        };
        return (
          <Link
            key={b.id}
            href={`/boards/${b.id}`}
            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
          >
            <Card className="flex flex-col p-6 transition-shadow hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-semibold tracking-tight">{b.title}</h3>
                  {b.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {b.description}
                    </p>
                  )}
                </div>
                <RoleBadge role={b.role} />
              </div>

              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {b.members.length} {b.members.length === 1 ? 'member' : 'members'}
                </span>
                <span className="tabular-nums">
                  {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  Updated {updated.toLocaleDateString()}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${b.title}`}
                    title="Edit"
                    onClick={(e) => {
                      stop(e);
                      onEdit(b);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${b.title}`}
                    title={isOwner ? 'Delete' : 'Only the owner can delete'}
                    disabled={!isOwner}
                    onClick={(e) => {
                      stop(e);
                      onDelete(b);
                    }}
                    className="hover:text-destructive disabled:hover:text-current"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
