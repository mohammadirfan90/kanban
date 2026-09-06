-- Convert `position` on columns and tasks from Float midpoints to base62
-- fractional-index keys, and add the unique constraints that make concurrent
-- reordering conflict-free.
--
-- Why: the Float scheme inserted at the arithmetic midpoint of two neighbours.
-- That exhausts Float64 precision after ~50 inserts into the same gap (the old
-- code papered over this with an O(n) renumber of the whole column), and two
-- concurrent inserts between the same neighbours compute the *same* midpoint —
-- so racing drags silently collapsed rows onto one position. Reproduced: 8
-- concurrent moves to index 0 left 7 of 8 tasks sharing position 0.5.
--
-- Backfill key shape
-- ------------------
-- Existing rows are renumbered in their current order to
--     'a0' || lpad(ordinal::text, 6, '0')
-- with a trailing '1' appended when that would end in '0' (a fractional part
-- may not end in '0'). Fixed-width decimal means lexicographic order equals
-- ordinal order, and 'a0…' is a valid integer-part prefix, so the result is a
-- legal input to generateKeyBetween. Supports 999,999 rows per parent, which
-- is well past anything this board will hold.
--
-- Ties on the old Float position (already-corrupted rows) are broken by id, so
-- the backfill is deterministic and repairs the duplicates rather than
-- failing on the new unique constraint.

-- ── columns ─────────────────────────────────────────────────────────────
ALTER TABLE "columns" ADD COLUMN "position_key" TEXT;

WITH ordered AS (
  SELECT
    "id",
    'a0' || lpad(
      (ROW_NUMBER() OVER (PARTITION BY "boardId" ORDER BY "position" ASC, "id" ASC))::text,
      6, '0'
    ) AS k
  FROM "columns"
)
UPDATE "columns" c
SET "position_key" = CASE WHEN right(o.k, 1) = '0' THEN o.k || '1' ELSE o.k END
FROM ordered o
WHERE c."id" = o."id";

ALTER TABLE "columns" DROP COLUMN "position";
ALTER TABLE "columns" RENAME COLUMN "position_key" TO "position";
ALTER TABLE "columns" ALTER COLUMN "position" SET NOT NULL;

-- ── tasks ───────────────────────────────────────────────────────────────
ALTER TABLE "tasks" ADD COLUMN "position_key" TEXT;

WITH ordered AS (
  SELECT
    "id",
    'a0' || lpad(
      (ROW_NUMBER() OVER (PARTITION BY "columnId" ORDER BY "position" ASC, "id" ASC))::text,
      6, '0'
    ) AS k
  FROM "tasks"
)
UPDATE "tasks" t
SET "position_key" = CASE WHEN right(o.k, 1) = '0' THEN o.k || '1' ELSE o.k END
FROM ordered o
WHERE t."id" = o."id";

ALTER TABLE "tasks" DROP COLUMN "position";
ALTER TABLE "tasks" RENAME COLUMN "position_key" TO "position";
ALTER TABLE "tasks" ALTER COLUMN "position" SET NOT NULL;

-- ── constraints ─────────────────────────────────────────────────────────
-- The old plain indexes are replaced by unique ones. A unique btree serves the
-- same ordered range scans, so keeping both would only add write overhead.
DROP INDEX IF EXISTS "columns_boardId_position_idx";
DROP INDEX IF EXISTS "tasks_columnId_position_idx";

-- These are what make ordering conflict-free: two writers racing to occupy the
-- same slot cannot both succeed. The loser gets a unique violation, which
-- TasksService.move catches and retries against freshly-read neighbours.
CREATE UNIQUE INDEX "columns_boardId_position_key" ON "columns"("boardId", "position");
CREATE UNIQUE INDEX "tasks_columnId_position_key" ON "tasks"("columnId", "position");
