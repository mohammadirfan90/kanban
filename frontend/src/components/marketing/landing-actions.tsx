'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { useAuth } from '@/contexts/AuthContext';

/**
 * The landing page is a server component, so it cannot read AuthContext.
 *
 * These two islands can. Without them the marketing header always offered
 * "Log in" and "Get started" — which made a signed-in visitor who landed here
 * believe they had been signed out, even though the session was untouched.
 *
 * While `loading` is true both render a fixed-size placeholder rather than the
 * signed-out state. Guessing "logged out" and correcting a moment later is the
 * flash that caused the confusion in the first place, and a placeholder of the
 * same size keeps the header from jumping.
 */

export function LandingNavActions() {
  const { user, loading } = useAuth();

  if (loading) return <div className="h-9 w-40" aria-hidden />;

  if (user) {
    return (
      <>
        <Button asChild>
          <Link href="/boards">
            Go to your boards
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Link
          href="/boards"
          aria-label={`Signed in as ${user.name}`}
          title={`Signed in as ${user.name}`}
          className="rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />
        </Link>
      </>
    );
  }

  return (
    <>
      <Button variant="ghost" asChild>
        <Link href="/login">Log in</Link>
      </Button>
      <Button asChild>
        <Link href="/register">
          Get started
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </>
  );
}

export function LandingHeroActions() {
  const { user, loading } = useAuth();

  if (loading) return <div className="h-11 w-64" aria-hidden />;

  if (user) {
    return (
      <Button size="lg" asChild>
        <Link href="/boards">
          Go to your boards
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button size="lg" asChild>
        <Link href="/register">
          Create your first board
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
      <Button size="lg" variant="outline" asChild>
        <Link href="/login">I already have an account</Link>
      </Button>
    </>
  );
}
