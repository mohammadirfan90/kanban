# Spec 06 — Columns CRUD

## Goal
Implement Column CRUD endpoints. Columns belong to boards and hold tasks. All endpoints enforce board access permissions.

## Context
- Backend: NestJS with Prisma (Specs 01-05 complete)
- Models: `Board`, `Column` with `position` (Float for ordering), `Task`
- Authorization: use the helper from Spec 05 — `boardsService.hasAccess(userId, boardId, minRole)` where minRole is EDITOR for mutations, VIEWER for reads

## Inputs
- Boards module + authorization helper available
- Prisma schema has Column model with `boardId, title, position, ...`
- Existing columns exist for newly created boards (3 default columns from Spec 05)

## Outputs
- `backend/src/columns/columns.module.ts`
- `backend/src/columns/columns.service.ts`
- `backend/src/columns/columns.controller.ts`
- `backend/src/columns/dto/create-column.dto.ts` — title, boardId, position (optional)
- `backend/src/columns/dto/update-column.dto.ts` — title?, position?
- `backend/src/columns/dto/reorder-columns.dto.ts` — ordered array of column IDs
- `backend/test/columns/columns.e2e-spec.ts`

## Constraints
- All endpoints require JWT
- Endpoints:
  - `POST /api/columns` — create column in a board (EDITOR or OWNER)
  - `PATCH /api/columns/:id` — update title or position (EDITOR or OWNER)
  - `DELETE /api/columns/:id` — delete column (EDITOR or OWNER, cascades to tasks)
  - `PUT /api/columns/reorder` — reorder all columns in a board (EDITOR or OWNER)
- **Position handling:** use fractional indexing
  - New column with no position: append to end (max existing + 1)
  - New column with explicit position: insert at that fractional position (avg of neighbors)
  - Reorder endpoint: takes ordered array of column IDs, recomputes positions
- Reorder request body:
  ```ts
  { boardId: string, columnIds: string[] }  // in desired order
  ```
- Each board should have at least one column (cannot delete the last remaining column) — return 400 if violated
- Cannot create a column with a `boardId` the caller doesn't have EDITOR+ access to
- Cannot delete a column whose board the caller doesn't have EDITOR+ access to
- Column title: 1-100 chars, required, trimmed
- Response shape:
  ```ts
  { id, boardId, title, position, createdAt, updatedAt, tasks: [...] }
  ```

## Acceptance Criteria
- [ ] `POST /api/columns` creates column with title, sets position to (max + 1) if not specified
- [ ] `POST /api/columns` returns 403 if user is VIEWER on the board
- [ ] `POST /api/columns` returns 403 if user has no access to boardId
- [ ] `POST /api/columns` with empty title returns 400
- [ ] `PATCH /api/columns/:id` updates title and/or position
- [ ] `PATCH /api/columns/:id` recomputes position if needed (no collisions)
- [ ] `PATCH /api/columns/:id` returns 403 if user is VIEWER
- [ ] `DELETE /api/columns/:id` cascades to all tasks in that column
- [ ] `DELETE /api/columns/:id` returns 400 if it's the last column in the board
- [ ] `DELETE /api/columns/:id` returns 403 if user is not EDITOR or OWNER
- [ ] `PUT /api/columns/reorder` reorders columns and persists new positions
- [ ] `PUT /api/columns/reorder` validates all columnIds belong to the same boardId
- [ ] `PUT /api/columns/reorder` returns 403 if user is not EDITOR/OWNER
- [ ] After reorder, GET /api/boards/:id returns columns in the new order
- [ ] E2E test covers all 4 endpoints + 5 error cases
- [ ] All queries avoid N+1 (use `include` for tasks)

## Out of Scope
- Column templates / color customization
- WIP limits per column
- Column archiving (soft delete)