'use client';

import Link from 'next/link';
import { LogOut, KanbanSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/mode-toggle';
import { useAuth } from '@/contexts/AuthContext';

export default function BoardsPage() {
  const { user, logout, loading } = useAuth();

  if (loading) {
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
              {user?.name ?? user?.email}
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
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight">Your boards</h1>
          <p className="mt-2 text-muted-foreground">
            Boards will appear here once you create them.
          </p>

          <div className="mt-12 flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
            <KanbanSquare className="h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-4 text-base font-semibold">No boards yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Board CRUD lands in Spec 05.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}