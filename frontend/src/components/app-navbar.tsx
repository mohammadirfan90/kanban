'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Monitor, Moon, Plus, Search, Sun, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/user-avatar';


export interface AppNavbarProps {
  /** Current search text, lifted so the page decides what searching means. */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  onCreateBoard?: () => void;
}

/**
 * The application chrome: one full-width bar across every signed-in page.
 *
 * Split from the board bar below it deliberately. This row belongs to the app
 * — who you are, finding things, making a board — and never changes as you
 * move around. The board bar underneath belongs to whichever board you are
 * looking at. Collapsing the two is what made the board page feel like a
 * separate site rather than a screen inside one.
 */
export function AppNavbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search boards and cards',
  onCreateBoard,
}: AppNavbarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // next-themes resolves on the client, so the current-theme tick would
  // mismatch the server render without this.
  useEffect(() => setMounted(true), []);

  // "/" focuses search, the way every tool with a search bar behaves — but not
  // while the user is already typing somewhere else.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSignOut = useCallback(async () => {
    await logout();
    router.replace('/login');
  }, [logout, router]);

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'Match system', icon: Monitor },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="flex h-14 w-full items-center gap-3 px-3 sm:px-4">
        {/*
          Logo renders its own <Link> (defaulting to "/"), so wrapping it in
          another one produced nested anchors. The browser un-nests those while
          parsing and the inner href wins, which sent people to the marketing
          page — where the signed-out header made it look like they had been
          logged out, though the session was never touched.
        */}
        <Logo href="/boards" className="shrink-0" />

        {/* Centre column, capped so it stays centred on ultrawide displays. */}
        <div className="flex flex-1 justify-center px-2">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={search ?? ''}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-9 pl-9 pr-9"
            />
            {search ? (
              <button
                type="button"
                onClick={() => onSearchChange?.('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:block">
                /
              </kbd>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {onCreateBoard && (
            <Button size="sm" onClick={onCreateBoard}>
              <Plus className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Create</span>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <div className="flex items-center gap-2.5">
                  <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Sun className="mr-2 h-4 w-4" />
                  Theme
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {themes.map(({ value, label, icon: Icon }) => (
                    <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
                      <Icon className="mr-2 h-4 w-4" />
                      {label}
                      {mounted && theme === value && (
                        <span className="ml-auto text-xs text-muted-foreground">✓</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void handleSignOut()}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

/** Shared padding for the board bar and canvas, so their edges line up. */
export const SHELL_PADDING = cn('px-3 sm:px-4');
