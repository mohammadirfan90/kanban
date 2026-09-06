import Link from 'next/link';
import { ArrowRight, MoonStar, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ModeToggle } from '@/components/mode-toggle';
import { Logo } from '@/components/logo';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Logo href="/" />
          <nav className="flex items-center gap-2">
            <ModeToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Built for the Webbriks technical assessment
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Organize your work, beautifully.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted-foreground">
            A calm, fast kanban board with shareable boards, instant drag-and-drop, and zero clutter.
            Built with Next.js, NestJS, and Prisma.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/register">
                Create your first board
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30">
        <div className="container px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Zap className="h-5 w-5" />}
              title="Instant feedback"
              description="Drag, drop, and reorder without waiting. Optimistic updates make every action feel immediate."
            />
            <FeatureCard
              icon={<Users className="h-5 w-5" />}
              title="Share with your team"
              description="Invite editors or viewers to any board. Permissions are clear, enforced, and visible."
            />
            <FeatureCard
              icon={<MoonStar className="h-5 w-5" />}
              title="Light or dark"
              description="A refined interface that respects your system theme. Persists across sessions."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="container flex h-16 items-center justify-between text-sm text-muted-foreground">
          <p>Webbriks Kanban &middot; Day 1 build</p>
          <p>Premium UI · Dark mode · Accessible</p>
        </div>
      </footer>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className="border bg-card">
      <CardContent className="space-y-2 p-6">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground">
          {icon}
        </div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}