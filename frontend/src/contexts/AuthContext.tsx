'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  authStore,
  fetchCurrentUser,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
} from '@/lib/auth';
import type { User } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // On mount, ask the backend who we are. The JWT is in an httpOnly
  // cookie so JS can't see it — we just fire /auth/me and trust the
  // browser to attach the cookie. If it 401s, the api client redirects.
  useEffect(() => {
    const cached = authStore.getUser();
    if (cached) setUser(cached);

    fetchCurrentUser()
      .then((u) => setUser(u))
      .catch(() => {
        // No valid session — show login.
        authStore.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiLogin(email, password);
      setUser(res.user);
    },
    [],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const res = await apiRegister(email, password, name);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
