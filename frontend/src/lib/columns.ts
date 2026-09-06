// Columns API client — typed wrappers around the /columns endpoints.

import { request } from './api';
import type { BoardTask, OrderKey } from './types';

export interface CreateColumnInput {
  boardId: string;
  title: string;
  // No `position`: ordering keys are opaque and server-generated. New columns
  // append; reordering goes through `reorderColumns`.
}

export interface UpdateColumnInput {
  title?: string;
}

export interface ReorderColumnsInput {
  boardId: string;
  columnIds: string[];
}

/** A column as returned by the API (with nested tasks). */
export interface ColumnResponse {
  id: string;
  boardId: string;
  title: string;
  position: OrderKey;
  createdAt: string;
  updatedAt: string;
  tasks: BoardTask[];
}

export async function createColumn(input: CreateColumnInput): Promise<ColumnResponse> {
  return request<ColumnResponse>('/columns', { method: 'POST', body: input });
}

export async function updateColumn(
  id: string,
  input: UpdateColumnInput,
): Promise<ColumnResponse> {
  return request<ColumnResponse>(`/columns/${id}`, { method: 'PATCH', body: input });
}

export async function deleteColumn(id: string): Promise<void> {
  await request<void>(`/columns/${id}`, { method: 'DELETE' });
}

export async function reorderColumns(input: ReorderColumnsInput): Promise<ColumnResponse[]> {
  return request<ColumnResponse[]>('/columns/reorder', { method: 'PUT', body: input });
}
