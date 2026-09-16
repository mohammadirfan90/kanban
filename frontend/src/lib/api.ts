// API client — wraps native fetch with cookie-based auth and typed errors.
//
// The JWT lives in an httpOnly cookie set by the backend on /auth/login
// and /auth/register. The browser sends it automatically as long as we
// pass `credentials: 'include'`. There is intentionally no JS access to
// the token — that's the whole point of this layer's redesign.

import type { ApiError } from './types';
import { currentSocketId } from './realtime';

function getApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

const API_URL = getApiUrl();

// Kept as a no-op shim so existing call sites that imported tokenStore
// keep compiling. All methods are no-ops: the cookie store is the
// browser's, and we never touch it from JS.
export const tokenStore = {
  get(): string | null {
    return null;
  },
  set(token: string): void {
    // Intentionally a no-op — see file header. Parameter kept for
    // signature compatibility with the prior localStorage-backed API.
    void token;
  },
  clear(): void {
    // Server /auth/logout clears the cookie. The SPA doesn't need to.
  },
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly details: string | string[];
  readonly errorName: string;

  constructor(apiError: ApiError) {
    const msg = Array.isArray(apiError.message)
      ? apiError.message.join(', ')
      : apiError.message;
    super(msg);
    this.name = 'ApiClientError';
    this.status = apiError.statusCode;
    this.details = apiError.message;
    this.errorName = apiError.error;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/*
  A single in-flight refresh, shared by every caller.

  The access token is short-lived (15 minutes), so a board page that fires
  several requests at once will see them all 401 within the same tick. Without
  this, each one would POST /auth/refresh independently — and because refresh
  tokens rotate, the first response would invalidate the token the others were
  still using, which the backend treats as replay and answers by revoking the
  whole session family. Concurrent refreshes would log the user out.

  Holding one promise means exactly one rotation happens and everyone waits on it.
*/
let refreshInFlight: Promise<boolean> | null = null;

/** Paths that must never trigger a refresh attempt, to avoid recursion. */
const NO_REFRESH_PATHS = ['/auth/refresh', '/auth/login', '/auth/register', '/auth/logout'];

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          credentials: 'include',
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        // Cleared on the next tick so callers that awaited this promise all
        // observe the same result before a new attempt can start.
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }
  return refreshInFlight;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, signal } = options;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };
  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  /*
    Tell the server which socket is making this change, so the broadcast it
    triggers can be stamped and we can ignore our own echo. We already applied
    the change optimistically; re-applying it would fight our local state, most
    visibly mid-drag where it would yank the card out from under the cursor.

    Set here rather than at each call site so no mutation can forget it. Absent
    when the socket has not connected, which is exactly the case where there is
    no echo to suppress.
  */
  const socketId = currentSocketId();
  if (socketId) {
    finalHeaders['X-Socket-Id'] = socketId;
  }

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  const send = (): Promise<Response> =>
    fetch(url, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      credentials: 'include',
    });

  let res = await send();

  // An expired access token is the ordinary case, not an error: rotate the
  // refresh cookie once and replay the request before surfacing anything.
  if (res.status === 401 && !NO_REFRESH_PATHS.some((p) => path.startsWith(p))) {
    if (await refreshSession()) {
      res = await send();
    }
  }

  // 204 No Content — return undefined cast
  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    if (res.status === 401) {
      /*
        The backend cleared the cookie, or the request lacked one.

        Listing which paths are PUBLIC was the wrong way round, and it was wrong
        four separate times: /register bounced new users away from the sign-up
        form, /b/ bounced anonymous visitors off a shared board, and "/" bounced
        them off the landing page — each found only after shipping, because the
        list silently failed to mention a page rather than failing loudly.

        Listing the paths that REQUIRE a session instead means a new public page
        needs no change here, and the failure mode of forgetting to add one is a
        page that does not redirect when it arguably should — visible and
        harmless — rather than a page nobody can reach.
      */
      const AUTHENTICATED_PREFIXES = ['/boards'];
      const onProtectedPage =
        typeof window !== 'undefined' &&
        AUTHENTICATED_PREFIXES.some((p) => window.location.pathname.startsWith(p));
      if (onProtectedPage) {
        window.location.href = '/login';
      }
    }
    if (isJson && payload && typeof payload === 'object') {
      throw new ApiClientError(payload as ApiError);
    }
    throw new ApiClientError({
      statusCode: res.status,
      message: typeof payload === 'string' ? payload : res.statusText,
      error: 'RequestError',
    });
  }

  return payload as T;
}
