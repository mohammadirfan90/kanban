# Spec 05 — Boards CRUD + Sharing

## Goal
Implement Board CRUD endpoints and the sharing mechanism that allows board owners to grant other registered users access (EDITOR or VIEWER) to their boards. All endpoints enforce authorization.

## Context
- Backend: NestJS with Prisma (Specs 01-04 complete)
- Models exist: `User`, `Board`, `BoardMember` with `BoardRole` enum (OWNER, EDITOR, VIEWER)
- Authorization rule: A user can view/mutate a board only if they are the OWNER OR a BoardMember. **Default deny.**

## Inputs
- Auth module complete (JWT guard available)
- Prisma schema includes Board, BoardMember, BoardRole enum
- Each new board automatically creates default columns: "To Do", "In Progress", "Done" (positions 1024, 2048, 3072 — large gaps leave room for fractional inserts in Spec 08 task movement)

## Outputs

### Backend
- `backend/src/boards/boards.module.ts`
- `backend/src/boards/boards.service.ts`
- `backend/src/boards/boards.controller.ts`
- `backend/src/boards/dto/create-board.dto.ts` — title (required), description (optional)
- `backend/src/boards/dto/update-board.dto.ts` — title?, description?
- `backend/src/boards/dto/share-board.dto.ts` — userId, role (EDITOR or VIEWER, not OWNER)
- `backend/test/boards/boards.e2e-spec.ts`

## Constraints
- All endpoints require JWT (use `@UseGuards(JwtAuthGuard)` at controller level)
- Endpoints:
  - `GET /api/boards` — list all boards user owns OR is member of
  - `POST /api/boards` — create board (caller becomes OWNER via BoardMember)
  - `GET /api/boards/:id` — get board with columns and tasks (if user has access)
  - `PATCH /api/boards/:id` — update (OWNER or EDITOR)
  - `DELETE /api/boards/:id` — delete (OWNER only, cascades to columns/tasks)
  - `POST /api/boards/:id/share` — share with another user (OWNER only)
  - `DELETE /api/boards/:id/share/:userId` — revoke access (OWNER only)
- **Authorization helpers:** `boardsService.hasAccess(userId, boardId, minRole?)` — returns true/false (boolean, single DB query, no throw); `assertAccess(userId, boardId, minRole?)` — throws 404/403, returns the caller's role (used internally by controllers). Role hierarchy: OWNER > EDITOR > VIEWER.
- Creating a board: in a transaction, create Board + BoardMember(OWNER) + 3 default Columns
- Sharing: validate that target user exists, validate that they are not already a member, validate that OWNER role cannot be granted (only via creation)
- Update board: only `title` and `description`, partial updates allowed
- Response shape for board:
  ```ts
  {
    id, title, description, ownerId,
    createdAt, updatedAt,
    role: 'OWNER' | 'EDITOR' | 'VIEWER',  // caller's role
    members: [{ userId, email, name, role }],
    columns: [{ id, title, position, tasks: [...] }]
  }
  ```
- N+1 prevention: use `include` with `select` to fetch members and columns in one query
- Sharing a board with a user who already has access: return 409 "Already a member"
- Revoking access: cannot revoke the OWNER's access (return 400)

## Acceptance Criteria
- [ ] `GET /api/boards` returns only boards user owns or is member of (NOT other users' boards)
- [ ] `POST /api/boards` creates board with 3 default columns and caller as OWNER
- [ ] `GET /api/boards/:id` returns 404 if board doesn't exist
- [ ] `GET /api/boards/:id` returns 403 if user has no access
- [ ] `GET /api/boards/:id` returns full board with columns and tasks if user has access
- [ ] `PATCH /api/boards/:id` returns 403 if user is VIEWER
- [ ] `PATCH /api/boards/:id` succeeds if user is EDITOR or OWNER
- [ ] `DELETE /api/boards/:id` returns 403 if user is not OWNER
- [ ] `DELETE /api/boards/:id` cascades: deleting board removes its columns, tasks, members
- [ ] `POST /api/boards/:id/share` with valid userId grants EDITOR/VIEWER role
- [ ] `POST /api/boards/:id/share` returns 403 if caller is not OWNER
- [ ] `POST /api/boards/:id/share` with non-existent userId returns 404
- [ ] `POST /api/boards/:id/share` with already-shared user returns 409
- [ ] `POST /api/boards/:id/share` with role=OWNER returns 400 (cannot transfer ownership)
- [ ] `DELETE /api/boards/:id/share/:userId` revokes access (returns 204)
- [ ] After revoke, former member cannot GET the board (403)
- [ ] E2E test covers: create, list, get, update by editor, update denied by viewer, share, share denied by editor, share denied for non-owner, revoke, cascading delete
- [ ] All queries use `include`/`select` to avoid N+1
- [ ] All endpoints return proper error format `{ statusCode, message, error }`

## Out of Scope
- Transfer ownership (no API in v1)
- Public/shared-with-link boards (must be explicit user)
- Board templates
- Board duplication
- Activity log
- Search/filter on list (just return all accessible boards)