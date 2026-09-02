# Spec 01 — Database Schema (Prisma)

## Goal
Design and implement the complete Prisma schema for the Mini Kanban Board, including all models, relations, indices, and enums. Generate the initial migration.

## Context
- Backend stack: **NestJS 10** with **Prisma** ORM
- Database: **PostgreSQL 16**
- Required features: user auth, boards, columns, tasks, board sharing with access control, drag-and-drop task ordering with stable order across moves
- This is the foundation — every backend spec depends on this schema being correct
- IDs use **UUID v4** (not auto-increment integers) to avoid enumeration attacks

## Inputs
- Empty `backend/prisma/` directory
- PostgreSQL connection string will come from `.env` as `DATABASE_URL`
- No existing models — greenfield schema

## Outputs
- `backend/prisma/schema.prisma` (create)
- `backend/.env.example` with `DATABASE_URL` placeholder (create)
- Generated Prisma client (auto on `prisma generate`)
- Initial migration file (auto on `prisma migrate dev`)

## Constraints
- **Models required:** `User`, `Board`, `BoardMember`, `Column`, `Task`
- `User` fields: `id` (UUID), `email` (unique), `passwordHash`, `name`, `createdAt`, `updatedAt`
- `Board` fields: `id` (UUID), `title`, `description` (nullable), `ownerId` (FK to User), `createdAt`, `updatedAt`
- `BoardMember` fields: `id` (UUID), `boardId` (FK), `userId` (FK), `role` (enum: OWNER, EDITOR, VIEWER), `createdAt`
  - Unique constraint on `(boardId, userId)`
- `Column` fields: `id` (UUID), `boardId` (FK), `title`, `position` (Float — for ordering), `createdAt`, `updatedAt`
  - Index on `(boardId, position)`
- `Task` fields: `id` (UUID), `columnId` (FK), `title`, `description` (nullable, TEXT), `position` (Float — fractional indexing), `assigneeId` (FK to User, nullable), `createdAt`, `updatedAt`
  - Index on `(columnId, position)`
- **Cascade behavior:** Deleting a Board cascades to its BoardMembers, Columns, and Tasks. Deleting a User cascades to their BoardMember rows but does NOT cascade to owned Boards (preserve data, transfer ownership is out of scope).
- **Relations:**
  - User 1:N Board (as owner)
  - User M:N Board (through BoardMember)
  - Board 1:N Column
  - Column 1:N Task
  - User 1:N Task (as assignee)
- Enums: `BoardRole` (OWNER, EDITOR, VIEWER)
- Use `@@map` for table names in snake_case (e.g., `board_members`)
- Add `@@index` for all FK columns and commonly queried fields
- Timestamps: use `@default(now())` and `@updatedAt`

## Acceptance Criteria
- [ ] `schema.prisma` is valid: `npx prisma validate` passes
- [ ] `npx prisma format` produces no changes (already formatted)
- [ ] `npx prisma migrate dev --name init` creates migration successfully
- [ ] `npx prisma generate` produces client without errors
- [ ] All 5 models exist with correct fields and types
- [ ] All FKs and cascade rules match spec
- [ ] Indexes exist on `(columnId, position)` and `(boardId, position)`
- [ ] `BoardMember` has unique constraint on `(boardId, userId)`
- [ ] `.env.example` documents `DATABASE_URL=postgresql://user:pass@localhost:5432/kanban?schema=public`

## Out of Scope
- Seed data (separate spec if needed)
- Soft deletes (use hard deletes for v1)
- Audit log / activity history
- Comments on tasks
- File attachments