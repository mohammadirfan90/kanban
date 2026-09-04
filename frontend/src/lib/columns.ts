// Columns API client — typed wrappers around the /columns endpoints.

import { request } from './api';

export interface CreateColumnInput {
  boardId: string;
  title: string;
  position?: number;
}

export interface UpdateColumnInput {
  title?: string;
  position?: number;
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
  position: number;
  createdAt: string;
  updatedAt: string;
  tasks: Array<{
    id: string;
    columnId: string;
    title: string;
    description: string | null;
    position: number;
    assignee: { id: string; name: string; email: string } | null;
    createdAt: string;
    updatedAt: string;
  }>;
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
