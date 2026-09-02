# Spec 07 — Tasks CRUD

## Goal
Implement Task CRUD endpoints. Tasks belong to columns and are ordered within a column. All endpoints enforce board access permissions through the parent column's board.

## Context
- Backend: NestJS with Prisma (Specs 01-06 complete)
- Models: `Column`, `Task` with `position` (Float for ordering), `assigneeId` (FK to User, nullable)
- Task move endpoint is its own spec (Spec 08) — this spec covers create/read/update/delete only
- Authorization: caller must have access to the parent board (VIEWER for reads, EDITOR for mutations)

## Inputs
- Boards + Columns modules complete
- Prisma schema has Task model with `columnId, title, description, position, assigneeId, ...`
- `boardsService.hasAccess(userId, boardId, minRole)` available

## Outputs
- `backend/src/tasks/tasks.module.ts`
- `backend/src/tasks/tasks.service.ts`
- `backend/src/tasks/tasks.controller.ts`
- `backend/src/tasks/dto/create-task.dto.ts` — columnId, title, description?, assigneeId?
- `backend/src/tasks/dto/update-task.dto.ts` — title?, description?, assigneeId?
- `backend/test/tasks/tasks.e2e-spec.ts`

## Constraints
- All endpoints require JWT
- Endpoints:
  - `POST /api/tasks` — create task in a column (EDITOR or OWNER)
  - `GET /api/tasks/:id` — get task details (VIEWER+)
  - `PATCH /api/tasks/:id` — update title/description/assignee (EDITOR or OWNER)
  - `DELETE /api/tasks/:id` — delete task (EDITOR or OWNER)
- **Position on create:** append to end of column. New position = (max existing position in column) + 1. If column is empty, position = 1.
- **Authorization check:** for any task operation, look up the task's column → boardId, then check access. Cache the lookup if needed but don't over-engineer for v1.
- Assignee validation: if `assigneeId` is provided, verify the user exists AND has access to the board (otherwise return 400 — can't assign to non-member)
- Task title: 1-200 chars, required, trimmed
- Task description: optional, max 5000 chars
- Response shape:
  ```ts
  {
    id, columnId, title, description, position,
    assignee: { id, name, email } | null,
    createdAt, updatedAt
  }
  ```
- Cannot create a task in a column belonging to a board the user doesn't have EDITOR access to
- Cannot update/delete a task if user is only VIEWER
- Deleting a task does NOT affect positions of other tasks (gaps are fine — fractional indexing handles it)

## Acceptance Criteria
- [ ] `POST /api/tasks` creates task with appended position
- [ ] `POST /api/tasks` returns 403 if user is VIEWER on the board
- [ ] `POST /api/tasks` returns 404 if columnId doesn't exist
- [ ] `POST /api/tasks` with empty title returns 400
- [ ] `POST /api/tasks` with description > 5000 chars returns 400
- [ ] `POST /api/tasks` with non-existent assigneeId returns 400
- [ ] `POST /api/tasks` with assigneeId of non-board-member returns 400
- [ ] `GET /api/tasks/:id` returns task with assignee object (no passwordHash leakage)
- [ ] `GET /api/tasks/:id` returns 403 if user has no board access
- [ ] `GET /api/tasks/:id` returns 404 if task doesn't exist
- [ ] `PATCH /api/tasks/:id` updates fields, returns updated task
- [ ] `PATCH /api/tasks/:id` returns 403 if user is VIEWER
- [ ] `DELETE /api/tasks/:id` removes task
- [ ] `DELETE /api/tasks/:id` returns 403 if user is VIEWER
- [ ] After deleting middle task, other tasks' positions unchanged (gap allowed)
- [ ] E2E test covers all 4 endpoints + 7 error cases
- [ ] Assignee response includes `id, name, email` only (no other fields)

## Out of Scope
- Task move endpoint (Spec 08)
- Task comments
- Task attachments / files
- Task labels / tags
- Task due dates
- Task checklists / subtasks
- Task activity history
- Bulk operations (delete multiple, move multiple)