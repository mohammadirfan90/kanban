'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { request } from '@/lib/api';

/** Google's mark, inline so the button needs no network request to render. */
function GoogleMark() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

/*
  Report a failed or cancelled Google round trip.

  The callback redirects here with ?error= rather than returning JSON, because
  the browser is mid-navigation and needs a page. Read from window rather than
  useSearchParams(): that hook opts the route out of static prerendering unless
  the page sits in a Suspense boundary, and `next build` fails on it.

  The message is deliberately vague on the failure path — the callback cannot
  say whether the state check, the code exchange or the account linking failed
  without telling an attacker which step they reached.
*/
function useOAuthError(): string | null {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get('error');
    if (!error) return;
    setMessage(
      error === 'google_cancelled'
        ? 'Google sign-in was cancelled.'
        : 'Google sign-in did not complete. Please try again.',
    );
    // Clear it so a refresh does not keep showing the same failure.
    window.history.replaceState(null, '', window.location.pathname);
  }, []);
  return message;
}

function apiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

/**
 * "Continue with Google", rendered only when the deployment has credentials.
 *
 * Asks the API first: a button that leads to "not configured" is worse than no
 * button at all, and whether Google is set up is deployment configuration
 * rather than anything secret.
 *
 * Navigates with `window.location` rather than fetch on purpose — this is a
 * full redirect out to Google's consent screen and back, not an XHR. The
 * session cookies are set by the callback, server-side, so no token ever
 * touches this page.
 */
export function GoogleButton({ label = 'Continue with Google' }: { label?: string }) {
  const [enabled, setEnabled] = useState(false);
  const oauthError = useOAuthError();

  useEffect(() => {
    let cancelled = false;
    request<{ google: boolean }>('/auth/providers')
      .then((p) => {
        if (!cancelled) setEnabled(p.google);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The error still has to surface even when the button is hidden — a
  // misconfigured deployment is exactly when someone lands here with ?error=.
  if (!enabled) {
    return oauthError ? (
      <p className="text-center text-sm text-destructive" role="alert">
        {oauthError}
      </p>
    ) : null;
  }

  return (
    <>
      {oauthError && (
        <p className="text-center text-sm text-destructive" role="alert">
          {oauthError}
        </p>
      )}
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or</span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => {
          window.location.href = `${apiBase()}/auth/google`;
        }}
      >
        <GoogleMark />
        {label}
      </Button>
    </>
  );
}
