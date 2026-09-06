// Auth API wrappers — thin functions around request().
//
// The JWT itself lives in an httpOnly cookie set by the backend. The
// frontend never sees the token. We only keep a cached copy of the user
// object in localStorage so the UI can render without a round-trip on
// every page load.

import { request } from './api';
import type { User } from './types';

export interface AuthResponse {
  user: User;
}

const USER_KEY = 'kanban_user';

export const authStore = {
  getUser(): User | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },
  setUser(user: User): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(USER_KEY);
  },
};

export async function login(email: string, password: string): Promise<AuthResponse> {
  // POST /auth/login — backend sets the httpOnly cookie and returns the user.
  const res = await request<{ user: User }>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  authStore.setUser(res.user);
  return res;
}

export async function register(
  email: string,
  password: string,
  name: string,
): Promise<AuthResponse> {
  const res = await request<{ user: User }>('/auth/register', {
    method: 'POST',
    body: { email, password, name },
  });
  authStore.setUser(res.user);
  return res;
}

export async function logout(): Promise<void> {
  // Tell the backend to clear the cookie, then drop the cached user.
  await request<{ ok: true }>('/auth/logout', { method: 'POST' });
  authStore.clear();
}

export async function fetchCurrentUser(): Promise<User> {
  // Backend reads the cookie via JwtStrategy — no token in JS land.
  const user = await request<User>('/auth/me');
  authStore.setUser(user);
  return user;
}