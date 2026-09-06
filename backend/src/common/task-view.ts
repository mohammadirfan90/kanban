import type { Task, TaskPriority } from '@prisma/client';
import { formatTaskKey } from './board-key';

/**
 * The single definition of how a task is presented to clients.
 *
 * Boards, columns and tasks all return nested tasks, and each used to build
 * that shape by hand. They drifted: the board response quietly omitted
 * `columnId` while the client's type declared it, so every read was `undefined`
 * and drag targets could not be resolved — with both sides type-checking
 * cleanly. One include and one mapper makes that class of divergence
 * impossible.
 */

export interface TaskLabelView {
  id: string;
  name: string;
  color: string;
}

export interface TaskView {
  id: string;
  columnId: string;
  boardId: string;
  /** Human-readable identifier, e.g. `PR-14`. Derived from the board, never stored. */
  key: string;
  number: number;
  title: string;
  description: string | null;
  position: string;
  priority: TaskPriority | null;
  dueDate: string | null;
  labels: TaskLabelView[];
  assignee: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Relations every task response needs.
 *
 * `board.key` is selected so the display key can be built without a second
 * query per task; `assignee` is narrowed to the public profile so a
 * passwordHash can never reach a response by accident.
 */
export const TASK_INCLUDE = {
  assignee: {
    select: { id: true, name: true, email: true },
  },
  board: {
    select: { key: true },
  },
  labels: {
    include: {
      label: { select: { id: true, name: true, color: true } },
    },
    orderBy: { label: { createdAt: 'asc' } },
  },
} as const;

/** What `TASK_INCLUDE` produces, so the mapper stays type-safe. */
export type TaskWithRelations = Task & {
  assignee: { id: string; name: string; email: string } | null;
  board: { key: string };
  labels: { label: TaskLabelView }[];
};

export function toTaskView(task: TaskWithRelations): TaskView {
  return {
    id: task.id,
    columnId: task.columnId,
    boardId: task.boardId,
    key: formatTaskKey(task.board.key, task.number),
    number: task.number,
    title: task.title,
    description: task.description,
    position: task.position,
    priority: task.priority,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    labels: task.labels.map((tl) => tl.label),
    assignee: task.assignee,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
