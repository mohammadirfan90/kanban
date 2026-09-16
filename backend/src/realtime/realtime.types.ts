import type { TaskView } from '../common/task-view';

/** Room holding authenticated members of a board. */
export const memberRoom = (boardId: string): string => `board:${boardId}`;

/**
 * Room holding anonymous visitors on a public link.
 *
 * Separate from the member room on purpose. Member events carry full task
 * payloads, which include `assignee.email`; broadcasting those into a room an
 * anonymous visitor can join would undo the leak-proof public projection. See
 * the note on PUBLIC_EVENT below.
 */
export const publicRoom = (boardId: string): string => `public:${boardId}`;

/** Events the server emits to board members. */
export const MEMBER_EVENT = {
  taskCreated: 'task:created',
  taskUpdated: 'task:updated',
  taskMoved: 'task:moved',
  taskDeleted: 'task:deleted',
  columnCreated: 'column:created',
  columnUpdated: 'column:updated',
  columnDeleted: 'column:deleted',
  columnsReordered: 'columns:reordered',
  /** Something changed that has no fine-grained event yet — refetch. */
  boardInvalidated: 'board:invalidated',
  /** Your access was removed; the client should leave. */
  accessRevoked: 'board:access-revoked',
  presenceState: 'presence:state',
  presenceDrag: 'presence:drag',
} as const;

/**
 * The ONLY event anonymous rooms ever receive.
 *
 * Public viewers are told "something changed" and refetch
 * `GET /api/public/boards/:slug`, rather than being sent entity payloads.
 *
 * That is deliberate. Member payloads and public payloads have different
 * shapes (the public one has no members, no ids, and assignees by name only),
 * so pushing entities to both audiences would mean maintaining a second
 * serialisation path inside the socket layer — and a mistake there leaks to
 * the open internet rather than to an authorised member. Refetching costs one
 * request and keeps the public projection defined in exactly one place.
 */
export const PUBLIC_EVENT = { invalidated: 'board:invalidated' } as const;

/** Who is currently on a board. Ephemeral — never persisted. */
export interface PresenceUser {
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** Task this user is currently dragging, if any. */
  draggingTaskId: string | null;
}

/**
 * Every broadcast carries the socket that caused it.
 *
 * The actor already applied the change optimistically, so re-applying the echo
 * would fight their own local state — most visibly mid-drag, where it would
 * yank the card they are holding. Clients drop any event whose `actorSocketId`
 * is their own.
 */
export interface BoardEvent<T> {
  actorSocketId: string | null;
  data: T;
}

export interface TaskMovedPayload {
  task: TaskView;
  fromColumnId: string;
}
