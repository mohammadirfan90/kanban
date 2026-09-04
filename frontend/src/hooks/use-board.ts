'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '@/lib/api';
import { getBoard } from '@/lib/boards';
import type { Board } from '@/lib/types';

export type BoardLoadErrorKind = 'not-found' | 'forbidden' | 'unknown';

export interface BoardLoadError {
  kind: BoardLoadErrorKind;
  message: string;
}

export interface UseBoardResult {
  board: Board | null;
  loading: boolean;
  error: BoardLoadError | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches a single board by id and exposes loading/error/refresh state.
 * - 404 → `error.kind = 'not-found'` (board truly doesn't exist)
 * - 403 → `error.kind = 'forbidden'` (no access or caller can't see it)
 * - anything else → `error.kind = 'unknown'`
 *
 * Caller is expected to redirect on `not-found` / `forbidden` if desired.
 */
export function useBoard(id: string): UseBoardResult {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<BoardLoadError | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBoard(id);
      setBoard(data);
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.status === 404) {
          setError({ kind: 'not-found', message: e.message });
        } else if (e.status === 403) {
          setError({ kind: 'forbidden', message: e.message });
        } else {
          setError({ kind: 'unknown', message: e.message });
        }
      } else {
        setError({ kind: 'unknown', message: 'Could not load board' });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return {
    board,
    loading,
    error,
    refresh: fetch,
  };
}
