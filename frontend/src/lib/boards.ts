// Boards API client — typed wrappers around the /boards endpoints.

import { request } from './api';
import type { Board, PublicBoard, PublicLink, PublicLinkStatus } from './types';

export interface CreateBoardInput {
  /** Palette token from lib/board-background.ts. */
  background?: string;
  title: string;
  description?: string;
}

export interface UpdateBoardInput {
  /** Palette token, or an empty string to reset to the default surface. */
  background?: string;
  title?: string;
  description?: string;
}

export interface ShareBoardInput {
  userId: string;
  role: 'EDITOR' | 'VIEWER';
}

export async function listBoards(): Promise<Board[]> {
  return request<Board[]>('/boards');
}

export async function getBoard(id: string): Promise<Board> {
  return request<Board>(`/boards/${id}`);
}

export async function createBoard(input: CreateBoardInput): Promise<Board> {
  return request<Board>('/boards', { method: 'POST', body: input });
}

export async function updateBoard(id: string, input: UpdateBoardInput): Promise<Board> {
  return request<Board>(`/boards/${id}`, { method: 'PATCH', body: input });
}

export async function deleteBoard(id: string): Promise<void> {
  await request<void>(`/boards/${id}`, { method: 'DELETE' });
}

export async function shareBoard(id: string, input: ShareBoardInput): Promise<Board> {
  return request<Board>(`/boards/${id}/share`, { method: 'POST', body: input });
}

export async function revokeBoardShare(id: string, userId: string): Promise<void> {
  await request<void>(`/boards/${id}/share/${userId}`, { method: 'DELETE' });
}
// ── Public links ────────────────────────────────────────────────────────

/** Create the board public link, or rotate it if one already exists. OWNER only. */
export async function createPublicLink(boardId: string): Promise<PublicLink> {
  return request<PublicLink>(`/boards/${boardId}/public-link`, { method: 'POST' });
}

/**
 * Owners receive the slug; other members receive only `{ isPublic }`.
 * The union is what the API actually returns, so callers have to narrow.
 */
export async function getPublicLink(boardId: string): Promise<PublicLink | PublicLinkStatus> {
  return request<PublicLink | PublicLinkStatus>(`/boards/${boardId}/public-link`);
}

export async function revokePublicLink(boardId: string): Promise<void> {
  return request<void>(`/boards/${boardId}/public-link`, { method: 'DELETE' });
}

/** Unauthenticated read of a shared board. No cookie required or sent. */
export async function getPublicBoard(slug: string): Promise<PublicBoard> {
  return request<PublicBoard>(`/public/boards/${encodeURIComponent(slug)}`);
}
