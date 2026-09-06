// API client — wraps native fetch with cookie-based auth and typed errors.
//
// The JWT lives in an httpOnly cookie set by the backend on /auth/login
// and /auth/register. The browser sends it automatically as long as we
// pass `credentials: 'include'`. There is intentionally no JS access to
// the token — that's the whole point of this layer's redesign.

import type { ApiError } from './types';

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

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, signal } = options;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };
  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
    credentials: 'include',
  });

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
        The backend cleared the cookie, or the request lacked one. Bounce to
        /login — but never from a page that is itself an unauthenticated
        destination.

        `/register` has to be in this list. AuthProvider probes /auth/me on
        every mount now that the JWT lives in an httpOnly cookie and JS can no
        longer check for a token first. On the sign-up page that probe always
        401s, so redirecting on it sent every visitor straight from the
        registration form to the login form — sign-up was unreachable.
      */
      const UNAUTHENTICATED_PATHS = ['/login', '/register'];
      const onPublicPage =
        typeof window !== 'undefined' &&
        UNAUTHENTICATED_PATHS.some((p) => window.location.pathname.startsWith(p));
      if (typeof window !== 'undefined' && !onPublicPage) {
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
