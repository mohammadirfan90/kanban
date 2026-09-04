// Boards API client — typed wrappers around the /boards endpoints.

import { request } from './api';
import type { Board } from './types';

export interface CreateBoardInput {
  title: string;
  description?: string;
}

export interface UpdateBoardInput {
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