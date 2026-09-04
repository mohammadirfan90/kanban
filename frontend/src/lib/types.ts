// Shared TS types matching backend API responses.

export type BoardRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** A single task as returned by the boards endpoint. */
export interface BoardTask {
  id: string;
  title: string;
  description: string | null;
  position: number;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A column in a board (with its tasks nested). */
export interface BoardColumn {
  id: string;
  title: string;
  position: number;
  tasks: BoardTask[];
}

/** A member on a board (with their user info flattened). */
export interface BoardMemberView {
  userId: string;
  email: string;
  name: string;
  role: BoardRole;
}

/** A board as returned by GET /api/boards and friends. */
export interface Board {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  /** The caller's role on this board. */
  role: BoardRole;
  members: BoardMemberView[];
  columns: BoardColumn[];
}

/** API error envelope (matches backend HttpExceptionFilter). */
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}