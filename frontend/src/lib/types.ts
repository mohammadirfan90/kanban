// Shared TS types matching backend API responses.

export type BoardRole = 'OWNER' | 'EDITOR' | 'VIEWER';

/**
 * A fractional-index ordering key (base62, compared lexicographically).
 *
 * Sort with `a.position < b.position`, never `a.position - b.position` — these
 * are opaque strings, not numbers. The backend generates them; clients never
 * construct one.
 *
 * @see backend/src/common/ordering/fractional-index.ts
 */
export type OrderKey = string;

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** A single task as returned by the boards/tasks endpoints. */
/** Ordered low -> urgent. `null` means "no priority set", which is not LOW. */
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

/**
 * Palette tokens a label may use — mirrors LABEL_COLORS on the server.
 * Tokens rather than hex so both themes can resolve their own value.
 */
export type LabelColor =
  | 'slate'
  | 'rose'
  | 'amber'
  | 'emerald'
  | 'sky'
  | 'indigo'
  | 'violet'
  | 'pink';

export const LABEL_COLORS: LabelColor[] = [
  'slate',
  'rose',
  'amber',
  'emerald',
  'sky',
  'indigo',
  'violet',
  'pink',
];

export interface BoardLabel {
  id: string;
  boardId: string;
  name: string;
  color: string;
  createdAt: string;
}

/** The label shape carried on a task (no boardId/createdAt). */
export interface TaskLabel {
  id: string;
  name: string;
  color: string;
}

export interface BoardTask {
  id: string;
  /** The column this task currently lives in. Mirrors the backend response. */
  columnId: string;
  boardId: string;
  /** Human-readable identifier, e.g. `PR-14`. Server-derived. */
  key: string;
  number: number;
  title: string;
  description: string | null;
  position: OrderKey;
  priority: TaskPriority | null;
  /** ISO-8601 timestamp, or null when no due date is set. */
  dueDate: string | null;
  labels: TaskLabel[];
  /** Nested assignee object (id/name/email only); null when unassigned. */
  assignee: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** A column in a board (with its tasks nested). */
export interface BoardColumn {
  id: string;
  title: string;
  position: OrderKey;
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
  /** Prefix for this board's task keys, e.g. `PR` in `PR-14`. */
  key: string;
  /** The caller's role on this board. */
  role: BoardRole;
  labels: BoardLabel[];
  members: BoardMemberView[];
  columns: BoardColumn[];
}

/** API error envelope (matches backend HttpExceptionFilter). */
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}