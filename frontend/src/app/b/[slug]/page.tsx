'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, Loader2 } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KanbanColumn } from '@/components/boards/kanban-column';
import { ModeToggle } from '@/components/mode-toggle';
import { getPublicBoard } from '@/lib/boards';
import { ApiClientError } from '@/lib/api';
import type { BoardColumn, PublicBoard } from '@/lib/types';

/**
 * A board shared by public link.
 *
 * Read-only by construction, not by permission check: this page renders
 * columns directly with `canEdit={false}` and never mounts a DndContext, a
 * create dialog or a task detail dialog. There is no code path here that can
 * issue a write, which matters because the visitor has no session to check.
 *
 * The backend sends a narrower payload than the authenticated board (no
 * members, no emails, no ids beyond what rendering needs), so the mapping
 * below fills in only what the presentational components require.
 */
export default function PublicBoardPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params.slug === 'string' ? params.slug : '';

  const [board, setBoard] = useState<PublicBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    getPublicBoard(slug)
      .then((b) => {
        if (!cancelled) setBoard(b);
      })
      .catch((e) => {
        // A revoked link and a link that never existed both arrive as 404, by
        // design — so this page cannot tell the visitor which it was either.
        if (!cancelled) setNotFound(e instanceof ApiClientError && e.status === 404);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  /*
    Adapt the public payload to the shape KanbanColumn already renders.

    The public API returns `assigneeName` rather than an assignee object,
    precisely so no email or user id crosses the wire. Rebuilding a minimal
    assignee here keeps the existing card component unchanged — it only ever
    reads `.name` for the avatar initials.
  */
  const columns: BoardColumn[] = useMemo(() => {
    if (!board) return [];
    return board.columns.map((column) => ({
      id: column.id,
      title: column.title,
      position: column.position,
      tasks: column.tasks.map((task) => ({
        ...task,
        boardId: '',
        number: 0,
        assignee: task.assigneeName ? { id: '', name: task.assigneeName, email: '' } : null,
      })),
    }));
  }, [board]);

  const noop = useCallback(() => undefined, []);
  const noopAsync = useCallback(async () => undefined, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !board) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <Logo />
        <h1 className="text-xl font-semibold tracking-tight">This link is not available</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The link may have been turned off by the board owner, or it may never have existed.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/login">Go to Kanban</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Logo />
            <span className="text-muted-foreground">/</span>
            <h1 className="truncate text-sm font-semibold tracking-tight">{board.title}</h1>
            <Badge variant="secondary" className="gap-1">
              <Eye className="h-3 w-3" />
              View only
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Button asChild size="sm" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      {board.description && (
        <p className="mx-auto w-full max-w-[1600px] px-4 pt-4 text-sm text-muted-foreground sm:px-6 lg:px-8">
          {board.description}
        </p>
      )}

      <main className="flex flex-1 flex-col px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col">
          <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                canEdit={false}
                isLastColumn={false}
                index={0}
                columnCount={0}
                pinned={false}
                onCopyColumn={noopAsync}
                onMoveColumnTo={noopAsync}
                onTogglePin={noop}
                onAddTask={noop}
                onOpenTask={noop}
                onRenameColumn={noopAsync}
                onDeleteColumn={noopAsync}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
