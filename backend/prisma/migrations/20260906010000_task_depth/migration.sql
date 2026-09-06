-- Task depth: priority, due dates, per-board labels, and human-readable task
-- keys (BOARD_KEY-NUMBER, e.g. PR-14).
--
-- Every column added to an existing table is either nullable or backfilled
-- before its NOT NULL constraint lands, so this runs cleanly against a
-- populated database.

-- ── priority ────────────────────────────────────────────────────────────
-- Nullable on purpose: "no priority" is a distinct state from LOW.
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

ALTER TABLE "tasks" ADD COLUMN "priority" "TaskPriority";
ALTER TABLE "tasks" ADD COLUMN "dueDate" TIMESTAMP(3);

-- ── board key + task counter ────────────────────────────────────────────
ALTER TABLE "boards" ADD COLUMN "key" TEXT;
ALTER TABLE "boards" ADD COLUMN "taskCounter" INTEGER NOT NULL DEFAULT 0;

-- Derive a key from the title: initials of the first words when the title has
-- several ("Product Roadmap" -> PR), otherwise the leading letters of the only
-- word ("Backlog" -> BACK). Non-alphanumerics are stripped first so titles like
-- "Q3 / Delivery" don't produce punctuation. Falls back to 'TASK' for a title
-- with no usable letters at all.
UPDATE "boards"
SET "key" = COALESCE(
  NULLIF(
    CASE
      WHEN array_length(regexp_split_to_array(trim(regexp_replace("title", '[^a-zA-Z0-9 ]', ' ', 'g')), '\s+'), 1) > 1
        THEN upper(substring(
          array_to_string(
            ARRAY(
              SELECT substring(word, 1, 1)
              FROM unnest(regexp_split_to_array(trim(regexp_replace("title", '[^a-zA-Z0-9 ]', ' ', 'g')), '\s+')) AS word
              WHERE word <> ''
            ),
            ''
          ), 1, 4))
      ELSE upper(substring(regexp_replace("title", '[^a-zA-Z0-9]', '', 'g'), 1, 4))
    END,
    ''
  ),
  'TASK'
);

ALTER TABLE "boards" ALTER COLUMN "key" SET NOT NULL;

-- ── task boardId + number ───────────────────────────────────────────────
ALTER TABLE "tasks" ADD COLUMN "boardId" TEXT;
ALTER TABLE "tasks" ADD COLUMN "number" INTEGER;

-- boardId is denormalised from the parent column. Safe to duplicate because
-- cross-board moves are rejected by TasksService.move, so it never changes.
UPDATE "tasks" t
SET "boardId" = c."boardId"
FROM "columns" c
WHERE c."id" = t."columnId";

-- Number tasks per board in creation order, so existing keys read chronologically.
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "boardId" ORDER BY "createdAt" ASC, "id" ASC) AS n
  FROM "tasks"
)
UPDATE "tasks" t
SET "number" = numbered.n
FROM numbered
WHERE t."id" = numbered."id";

ALTER TABLE "tasks" ALTER COLUMN "boardId" SET NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "number" SET NOT NULL;

-- Park each board's counter past its highest existing number so the next
-- created task cannot collide with a backfilled one.
UPDATE "boards" b
SET "taskCounter" = COALESCE((SELECT max(t."number") FROM "tasks" t WHERE t."boardId" = b."id"), 0);

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "tasks_boardId_number_key" ON "tasks"("boardId", "number");
CREATE INDEX "tasks_dueDate_idx" ON "tasks"("dueDate");

-- ── labels ──────────────────────────────────────────────────────────────
CREATE TABLE "labels" (
  "id" TEXT NOT NULL,
  "boardId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "labels_boardId_name_key" ON "labels"("boardId", "name");

ALTER TABLE "labels"
  ADD CONSTRAINT "labels_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "task_labels" (
  "taskId" TEXT NOT NULL,
  "labelId" TEXT NOT NULL,
  CONSTRAINT "task_labels_pkey" PRIMARY KEY ("taskId", "labelId")
);

CREATE INDEX "task_labels_labelId_idx" ON "task_labels"("labelId");

ALTER TABLE "task_labels"
  ADD CONSTRAINT "task_labels_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_labels"
  ADD CONSTRAINT "task_labels_labelId_fkey"
  FOREIGN KEY ("labelId") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
