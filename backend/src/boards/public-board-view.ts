import type { Board, Column, Task, TaskPriority } from '@prisma/client';
import { formatTaskKey } from '../common/board-key';

/**
 * The shape an anonymous visitor sees.
 *
 * This is a SECOND mapper, deliberately not a flag on `toBoardResponse`.
 *
 * The authenticated board response carries `members[].email` and
 * `assignee.email`, because a member is already entitled to see who they work
 * with. A public link is handed to people with no relationship to the board at
 * all, so reusing that mapper would publish every collaborator's email address
 * to anyone holding the URL.
 *
 * A boolean parameter (`includeEmails: false`) would have been shorter and is
 * exactly how the email gets added back by accident later — someone extends
 * the shared mapper for the authenticated case and never considers the public
 * one. The fields below are the allowlist: anything not named here cannot
 * escape, whatever happens to the other mapper. `no-emails.e2e-spec` asserts
 * the serialised payload contains no `@` at all.
 *
 * Note what is absent as much as what is present: no board id, no ownerId, no
 * members, no roles, no user ids. A visitor gets the content of the board and
 * nothing about the people behind it beyond a display name.
 */

export interface PublicTaskLabelView {
  id: string;
  name: string;
  color: string;
}

export interface PublicTaskView {
  id: string;
  columnId: string;
  key: string;
  title: string;
  description: string | null;
  position: string;
  priority: TaskPriority | null;
  dueDate: string | null;
  labels: PublicTaskLabelView[];
  /** Display name only. No email, no id — a visitor cannot resolve a person. */
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicColumnView {
  id: string;
  title: string;
  position: string;
  tasks: PublicTaskView[];
}

export interface PublicBoardView {
  title: string;
  description: string | null;
  key: string;
  updatedAt: string;
  labels: PublicTaskLabelView[];
  columns: PublicColumnView[];
}

/** Relations the public view needs — narrower than TASK_INCLUDE by design. */
export const PUBLIC_BOARD_INCLUDE = {
  labels: {
    orderBy: { createdAt: 'asc' as const },
    select: { id: true, name: true, color: true },
  },
  columns: {
    orderBy: { position: 'asc' as const },
    include: {
      tasks: {
        orderBy: { position: 'asc' as const },
        include: {
          // `name` only. Selecting the whole relation here is what would leak
          // the email, so the select is explicit and minimal.
          assignee: { select: { name: true } },
          labels: {
            include: { label: { select: { id: true, name: true, color: true } } },
            orderBy: { label: { createdAt: 'asc' as const } },
          },
        },
      },
    },
  },
} as const;

type PublicTaskRow = Task & {
  assignee: { name: string } | null;
  labels: { label: PublicTaskLabelView }[];
};

export type PublicBoardRow = Board & {
  labels: PublicTaskLabelView[];
  columns: (Column & { tasks: PublicTaskRow[] })[];
};

export function toPublicBoardView(board: PublicBoardRow): PublicBoardView {
  return {
    title: board.title,
    description: board.description,
    key: board.key,
    updatedAt: board.updatedAt.toISOString(),
    labels: board.labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
    columns: board.columns.map((column) => ({
      id: column.id,
      title: column.title,
      position: column.position,
      tasks: column.tasks.map((task) => ({
        id: task.id,
        columnId: task.columnId,
        key: formatTaskKey(board.key, task.number),
        title: task.title,
        description: task.description,
        position: task.position,
        priority: task.priority,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        labels: task.labels.map((tl) => tl.label),
        assigneeName: task.assignee?.name ?? null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      })),
    })),
  };
}
