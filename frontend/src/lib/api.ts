// API client — wraps native fetch with JWT injection and typed errors.

import type { ApiError } from './types';

const TOKEN_KEY = 'kanban_token';
const USER_KEY = 'kanban_user';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export const tokenStore = {
  get(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  set(token: string): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
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

  const token = tokenStore.get();
  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };
  if (token) {
    finalHeaders['Authorization'] = `Bearer ${token}`;
  }
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
