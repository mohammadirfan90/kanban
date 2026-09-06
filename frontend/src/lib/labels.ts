// Labels API client — typed wrappers around the /labels endpoints.
//
// Labels are board-scoped: listing and creation hang off /boards/:id, while
// mutating an existing label addresses it directly.

import { request } from './api';
import type { BoardLabel, LabelColor } from './types';

export interface CreateLabelInput {
  name: string;
  color: LabelColor;
}

export interface UpdateLabelInput {
  name?: string;
  color?: LabelColor;
}

export function listLabels(boardId: string): Promise<BoardLabel[]> {
  return request<BoardLabel[]>(`/boards/${boardId}/labels`);
}

export function createLabel(boardId: string, input: CreateLabelInput): Promise<BoardLabel> {
  return request<BoardLabel>(`/boards/${boardId}/labels`, { method: 'POST', body: input });
}

export function updateLabel(labelId: string, input: UpdateLabelInput): Promise<BoardLabel> {
  return request<BoardLabel>(`/labels/${labelId}`, { method: 'PATCH', body: input });
}

export function deleteLabel(labelId: string): Promise<void> {
  return request<void>(`/labels/${labelId}`, { method: 'DELETE' });
}
