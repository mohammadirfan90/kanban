// Auth API wrappers — thin functions around request() that handle JWT + user storage.

import { request, tokenStore } from './api';
import type { User } from './types';

export interface AuthResponse {
  access_token: string;
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
    tokenStore.clear();
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(USER_KEY);
  },
};

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  tokenStore.set(res.access_token);
  authStore.setUser(res.user);
  return res;
}

export async function register(
  email: string,
  password: string,
  name: string,
): Promise<AuthResponse> {
  const res = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password, name },
  });
  tokenStore.set(res.access_token);
  authStore.setUser(res.user);
  return res;
}

export async function logout(): Promise<void> {
  authStore.clear();
}

export async function fetchCurrentUser(): Promise<User> {
  const user = await request<User>('/auth/me');
  authStore.setUser(user);
  return user;
}