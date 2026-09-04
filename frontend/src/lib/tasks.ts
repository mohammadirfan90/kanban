// Tasks API client — typed wrappers around the /tasks endpoints.

import { request } from './api';

export interface CreateTaskInput {
  columnId: string;
  title: string;
  description?: string;
  assigneeId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  /** Pass `null` to explicitly unassign; omit to leave unchanged. */
  assigneeId?: string | null;
}

export interface MoveTaskInput {
  targetColumnId: string;
  /** 0-based position in the target column AFTER the move. */
  newIndex: number;
}

export interface TaskResponse {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  position: number;
  assignee: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export async function createTask(input: CreateTaskInput): Promise<TaskResponse> {
  return request<TaskResponse>('/tasks', { method: 'POST', body: input });
}

export async function getTask(id: string): Promise<TaskResponse> {
  return request<TaskResponse>(`/tasks/${id}`);
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<TaskResponse> {
  return request<TaskResponse>(`/tasks/${id}`, { method: 'PATCH', body: input });
}

export async function deleteTask(id: string): Promise<void> {
  await request<void>(`/tasks/${id}`, { method: 'DELETE' });
}

export async function moveTask(id: string, input: MoveTaskInput): Promise<TaskResponse> {
  return request<TaskResponse>(`/tasks/${id}/move`, { method: 'PATCH', body: input });
}
