# Spec 08 — Task Movement Endpoint

## Goal
Implement `PATCH /api/tasks/:id/move` — move a task within or across columns with stable, conflict-free ordering using fractional indexing.

## Context
- Backend: NestJS with Prisma (Specs 01-07 complete)
- Tasks are stored with `position: Float` for ordering
- Frontend drag-drop UI will consume this endpoint (Spec 10)
- This is the core "ordering remains stable, accurate, and conflict-free" requirement from the assessment

## Inputs
- Tasks CRUD complete
- Prisma schema has Task with `position: Float`
- `boardsService.hasAccess(userId, boardId, minRole)` available

## Outputs
- `backend/src/tasks/tasks.service.ts` — add `moveTask(userId, taskId, dto)` method
- `backend/src/tasks/tasks.controller.ts` — add `PATCH /:id/move` handler
- `backend/src/tasks/dto/move-task.dto.ts` — `{ targetColumnId: string, newIndex: number }`
- `backend/test/tasks/move.e2e-spec.ts`

## Constraints
- Endpoint: `PATCH /api/tasks/:id/move`
- Request body:
  ```ts
  {
    targetColumnId: string;   // destination column
    newIndex: number;          // 0-based position in target column after move
  }
  ```
- **Authorization:** caller must have EDITOR or OWNER on the source task's parent board
- **Source task:** look up by `:id`, get its current `columnId` and `position`
- **Behavior:**
  1. Load all tasks in target column, ordered by `position` ASC
  2. Remove source task from source column if cross-column move (decrement positions in source column is NOT done — gaps are fine)
  3. Compute new position:
     - If target column is empty: `newPosition = 1`
     - If `newIndex === 0` (insert at start): `newPosition = firstTask.position / 2`
     - If `newIndex >= targetTasks.length` (append): `newPosition = lastTask.position + 1`
     - Otherwise (insert between two): `newPosition = (prevTask.position + nextTask.position) / 2`
  4. If `newPosition` is within `1e-10` of a neighbor's position (precision exhausted), trigger rebalance:
     - Reload tasks in target column in final order
     - Renumber to evenly spaced positions starting from 1 (step 1.0)
  5. Update source task's `columnId` and `position`
  6. Return updated task
- **Transaction:** wrap steps 4-5 in `prisma.$transaction`
- **Error cases:**
  - Task not found → 404
  - Target column not found → 404
  - Caller has no EDITOR+ on board → 403
  - `newIndex` is negative → 400
- **Performance:** all queries must select only needed fields, no N+1

## Acceptance Criteria
- [ ] `PATCH /api/tasks/:id/move` moves task within same column to position 0 → task is first
- [ ] Move within same column to last position → task is at end
- [ ] Move within same column to middle position → correct fractional position computed
- [ ] Move across columns → task's columnId updated, other tasks in both columns unaffected
- [ ] Move to empty column → position = 1
- [ ] Move to position 0 in column with 1 task at position 1 → new position = 0.5
- [ ] Move to position 1 in column with tasks at positions 1 and 2 → new position = 1.5
- [ ] Move by VIEWER → 403
- [ ] Move task in board user has no access to → 403
- [ ] Move non-existent task → 404
- [ ] Move to non-existent column → 404
- [ ] Negative newIndex → 400
- [ ] Two concurrent moves to same target position → both succeed, no 500, last write wins (acceptable v1 trade-off)
- [ ] After many sequential moves, no precision exhaustion (rebalance triggers when needed)
- [ ] E2E test in `move.e2e-spec.ts` covers at least:
  - Move within same column (start, middle, end)
  - Move across columns (forward, backward)
  - Move to empty column
  - Permission denied (viewer)
  - Not found (task, column)
  - Validation (negative index)
  - Rebalance scenario (simulate by moving many times)
- [ ] Response includes the updated task with new `columnId` and `position`
- [ ] Existing tasks in target column are NOT renumbered on a normal move (only on rebalance)

## Out of Scope
- WebSocket broadcasting of move events to other connected users
- Optimistic locking / conflict detection across users (v2)
- Bulk moves (move multiple tasks at once)
- Animation triggers from server side
- Undo / redo