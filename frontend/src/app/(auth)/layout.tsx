import type { ReactNode } from 'react';
import { Layers } from 'lucide-react';
import { Logo } from '@/components/logo';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left decorative panel (lg+) */}
      <aside className="relative hidden border-r bg-muted/30 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo />

        <div className="space-y-6">
          <Layers className="h-10 w-10 text-muted-foreground/60" strokeWidth={1.25} />
          <blockquote className="space-y-3">
            <p className="text-2xl font-semibold leading-tight tracking-tight">
              Organize your work, beautifully.
            </p>
            <p className="text-sm text-muted-foreground">
              A calm, fast kanban board with shareable boards and real-time drag-and-drop.
            </p>
          </blockquote>
        </div>

        <p className="text-xs text-muted-foreground">
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