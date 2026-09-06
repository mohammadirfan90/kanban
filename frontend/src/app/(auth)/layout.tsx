import type { ReactNode } from 'react';
import { Layers } from 'lucide-react';
import { Logo } from '@/components/logo';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left decorative panel (lg+) */}
      <aside className="relative hidden overflow-hidden border-r bg-muted/20 lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Subtle dot matrix pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-45 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:24px_24px]"
          aria-hidden="true"
        />

        {/* Ambient mesh glow orbs using design system tokens */}
        <div
          className="pointer-events-none absolute -top-24 -left-20 h-96 w-96 rounded-full bg-kanban-owner/15 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute top-1/2 -right-24 h-80 w-80 -translate-y-1/2 rounded-full bg-kanban-editor/12 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-10 h-72 w-72 rounded-full bg-primary/5 blur-2xl"
          aria-hidden="true"
        />

        {/* Header Logo */}
        <div className="relative z-10">
          <Logo />
        </div>

        {/* Hero message */}
        <div className="relative z-10 space-y-6">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border/70 bg-background/70 shadow-xs backdrop-blur-sm">
            <Layers className="h-5 w-5 text-foreground/80" strokeWidth={1.5} />
          </div>
          <blockquote className="space-y-3">
            <p className="text-2xl font-semibold leading-tight tracking-tight">
              Organize your work, beautifully.
            </p>
            <p className="text-sm text-muted-foreground">
              A calm, fast kanban board with shareable boards and instant drag-and-drop.
            </p>
          </blockquote>
        </div>

        {/* Footer info */}
        <p className="relative z-10 text-xs text-muted-foreground">
          Webbriks Kanban &middot; Day 1 build
        </p>
      </aside>

      {/* Right form panel */}
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}