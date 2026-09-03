// Shared TS types matching backend API responses.
// Stubs here — backend (Spec 04-08) will confirm exact shapes.

export type BoardRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardMember {
  id: string;
  boardId: string;
  userId: string;
  role: BoardRole;
  createdAt: string;
  user?: Pick<User, 'id' | 'email' | 'name'>;
}

export interface Column {
  id: string;
  boardId: string;
  title: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  position: number;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
}

// API error envelope (matches backend HttpExceptionFilter)
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}
