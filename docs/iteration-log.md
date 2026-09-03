# Iteration Log — Webbriks Kanban Build

A chronological record of what was built, what was decided, and why.

Entries are appended by the agent after every non-trivial iteration (see `/AGENTS.md` for the rule).

---

## [2026-09-03 00:09] — Iteration 0: Project setup & spec scaffold

**Phase:** Pre-build / Setup

### What was built
- Created `DESIGN.md` — UI design contract (premium aesthetic, shadcn/ui only, color tokens, typography, motion rules)
- Created `/specs/` directory with 10 specifications covering Days 1-3:
  - `01-database-schema.md` — Prisma schema (User, Board, BoardMember, Column, Task)
  - `02-backend-scaffold.md` — NestJS 10 setup with CORS, ValidationPipe, error filter
  - `03-frontend-scaffold.md` — Next.js 14 + shadcn/ui + Sonner + dark mode
  - `04-auth-module.md` — JWT register/login + premium auth pages
  - `05-boards-crud.md` — Board CRUD + sharing with role-based permissions
  - `06-columns-crud.md` — Column CRUD with fractional position indexing
  - `07-tasks-crud.md` — Task CRUD with assignee validation
  - `08-task-movement.md` — Task move endpoint with conflict-free fractional ordering
  - `09-board-sharing-ui.md` — Share modal, member list, role badges
  - `10-drag-drop-ui.md` — Drag-and-drop kanban board (premium, polished)
- Created `AGENTS.md` — agent behavior rules (hard rules, workflow, iteration logging)
- Created `.gitignore` (`.puku`, `.agents`, `.puku-cli`, `temp-docs/`)
- Created `temp-docs/` with original PDF brief and extracted markdown

### Decisions
- **Stack choice: NestJS + Next.js + Prisma + shadcn/ui** — matches the assessment's stated tech stack and gives premium feel
- **Ordering algorithm: fractional indexing (Float position)** — avoids renumbering tasks on every move, handles concurrent writes gracefully
- **Auth: JWT with bcrypt cost 12** — industry standard, balances security and performance for v1
- **Design tokens: CSS variables + Tailwind** — enables dark mode, prevents hardcoded colors, allows future theming
- **Component library: shadcn/ui only** — owned code, Radix accessibility, premium out of the box; rejected Material/MUI as too heavy
- **Font: Inter** — premium, neutral, matches Linear/Vercel aesthetic
- **Iteration logging: append-only log + chat summary** — gives a permanent record without scrolling through chat

### Files touched
- `AGENTS.md` — create
- `DESIGN.md` — create (replaced alpha stub)
- `.gitignore` — create
- `specs/00-index.md` — create
- `specs/01-10` — create
- `docs/iteration-log.md` — create
- `temp-docs/` — create (gitignored)

### Considered but rejected
- **Material UI / Chakra / MUI** — too heavy, doesn't match premium aesthetic, would fight with Tailwind
- **Pages Router for Next.js** — App Router is current best practice, better for layouts
- **redux/zustand for state** — overkill for v1; React Context + useState sufficient
- **WebSockets for real-time** — explicitly out of scope; v1 is single-user optimistic
- **Hardcoded design tokens (no CSS variables)** — would block dark mode and future theming
- **Skip DESIGN.md** — agents would drift to inconsistent UI; rejected as too risky

### Next
- Spec 11: Docker setup (`docker-compose.yml` with Postgres + backend + frontend)
- Spec 12: README with setup steps + deployment guide
- Initialize git repo (if not already) and make first commit with all scaffolding
- Begin Day 1: Spec 01 (database schema) — then parallel Spec 02 + 03

---

## [2026-09-03 01:25] — Iteration 1: Initialize git, rename to main, commit foundation

**Phase:** Setup

### What was built
- Initialized git repo at `F:/AIProjects/webbrikstest/.git/`
- Renamed default branch from `master` to `main`
- Committed all foundation files: AGENTS.md, DESIGN.md, .gitignore, docs/iteration-log.md, all 10 specs (00-index + 01-10)
- Commit `da8abd9`: "Add project conventions, design contract, and work specs"

### Decisions
- **Default branch: `main` (not `master`)** — modern convention, GitHub default, matches most CI/CD tools
- **Single commit for the foundation** — these files are conceptually one unit (project conventions + spec set); splitting them would create artificial checkpoints
- **Commit message: one line, no body** — matches the global rule in `AGENTS.md` and `~/.puku-cli/settings.json` (no Co-Authored-By, no multi-paragraph)

### Files touched
- `.git/` — created (git init)
- `main` branch — created (renamed from master)
- 15 files committed (see commit `da8abd9`)

### Considered but rejected
- **Multiple commits per file type** (one for AGENTS.md, one for DESIGN.md, etc.) — too granular, no real value at this stage
- **Keep `master` as default** — outdated convention, requires extra work when pushing to GitHub later
- **Empty initial commit first, then commit files** — pointless ceremony

### Next
- Write Spec 11 (Docker setup) and Spec 12 (README + deployment)
- Begin Day 1 build: Spec 01 (Prisma schema)
- Optional: create the GitHub remote and push

---

## [2026-09-03 02:14] — Iteration 2: Specs 11 & 12 + Spec 01 build (Prisma schema)

**Phase:** Day 1 / Database

### What was built
- Wrote Spec 11 (`11-docker.md`) — full docker-compose stack: postgres + backend + frontend, with healthchecks, named volumes, env wiring, and dev hot-reload
- Wrote Spec 12 (`12-readme-deployment.md`) — README + deployment guide covering local dev, Docker, env vars, troubleshooting, and a smoke-test checklist
- Implemented Spec 01 (`01-database-schema.md`):
  - Created `backend/` skeleton (package.json, .env, .env.example, prisma/)
  - Authored `prisma/schema.prisma` — 5 models (User, Board, BoardMember, Column, Task) with UUID PKs, fractional Float positions, correct cascade rules, and 5 indices
  - Created `prisma.config.ts` — Prisma 7 requires config-file datasource; uses `@prisma/adapter-pg` driver adapter
  - Installed deps (`prisma@7.10.0`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `dotenv`, `@types/pg`)
  - Generated migration SQL via `prisma migrate diff --from-empty --to-schema ... --script` and wrote to `prisma/migrations/20260101000000_init/migration.sql`
  - Created `prisma/migrations/migration_lock.toml` (provider lockfile for `migrate deploy`)
  - Validated schema (`prisma validate` ✅), formatted (`prisma format` ✅), regenerated client (`prisma generate` ✅)
  - Applied migration to local Postgres via `docker exec psql < migration.sql` — verified all 5 tables exist in DB

### Decisions
- **Prisma 7 with driver adapter** — Prisma 7 removed `url` from `schema.prisma`; using `prisma.config.ts` + `@prisma/adapter-pg` is the official path and keeps runtime fast (Rust-free client with a Node `pg` driver)
- **`ownerId` onDelete: Restrict (not Cascade)** — Spec 01 explicitly forbids cascade-deleting owned boards when a User is deleted; deleting a user must force explicit board cleanup first
- **`assigneeId` onDelete: SetNull** — if an assignee is deleted, the task should stay in its column with no assignee rather than vanish
- **Float (DOUBLE PRECISION) for position** — fractional indexing lets us slot a task between two others without renumbering the whole column, which Spec 08 (task movement) depends on
- **Migration applied via `docker exec` + stdin redirect** — local Docker Postgres rejects password auth from host even with `POSTGRES_HOST_AUTH_METHOD=trust` env (Alpine image quirk); piping the SQL file into `docker exec psql` is reliable and isolates DB state from networking issues
- **Single source of truth for migration SQL** — generated by `prisma migrate diff` (canonical), not hand-written, so the schema and migration can never drift

### Files touched
- `specs/11-docker-compose.md` — create
- `specs/12-readme-deployment.md` — create
- `backend/package.json` — create (Prisma deps only)
- `backend/.env.example` — create (DATABASE_URL + JWT_* + CORS + PORT + NODE_ENV)
- `backend/.env` — create (local dev values; gitignored)
- `backend/prisma/schema.prisma` — create (5-model schema)
- `backend/prisma.config.ts` — create (Prisma 7 config with pg adapter)
- `backend/prisma/migrations/migration_lock.toml` — create (provider: postgresql)
- `backend/prisma/migrations/20260101000000_init/migration.sql` — create (generated)
- `docs/iteration-log.md` — append (this entry)

### Considered but rejected
- **Prisma 5 / Prisma 6** — user wanted latest; Prisma 7 is current and uses the new config-file pattern, worth the migration cost
- **Auto-applied migration via `prisma migrate dev`** — blocked by Docker networking quirk on this Windows host; instead generated the SQL via `migrate diff` (no DB needed) and applied via `psql` over the Docker exec channel. Same end state, more reliable on this setup.
- **`url = env("DATABASE_URL")` in schema.prisma** — removed in Prisma 7; would fail `prisma validate`
- **`onDelete: Cascade` on Board.ownerId** — would silently destroy all data if a user is deleted; spec explicitly forbids this
- **`Int` position** — would force renumbering on every move, creating concurrency and performance issues
- **Adding NestJS deps now** — Spec 02 will add them when we actually need them; keeping `backend/package.json` minimal until then

### Verification
- `npx prisma validate` → ✅ "The schema at prisma/schema.prisma is valid"
- `npx prisma format` → ✅ "Formatted prisma/schema.prisma" (cosmetic only)
- `npx prisma generate` → ✅ Client regenerated to `node_modules/@prisma/client`
- `docker exec kanban-pg psql ... -c "\\dt"` → 5 tables: `users`, `boards`, `board_members`, `columns`, `tasks`

### Known caveats
- Postgres auth via host-side `prisma migrate dev` still doesn't work in this environment due to Docker networking. The migration is applied, but future migrations via the CLI will need to either: (a) be applied via `docker exec psql < migration.sql`, or (b) once we set up `docker-compose` per Spec 11, connect through the compose network which behaves correctly. Not blocking — Spec 02 will resolve this when we wire up the backend.
- `_prisma_migrations` table was not auto-populated by Prisma (since we applied manually). For Spec 02's `migrate deploy` workflow, we'll either seed this row manually or use `prisma migrate resolve` once the host-side auth is sorted.

### Next
- Spec 02: NestJS 10 scaffold (modules, CORS, ValidationPipe, error filter, PrismaService)
- Spec 03: Next.js 14 + shadcn/ui scaffold (in parallel with Spec 02)
- Wire `prisma migrate deploy` into a docker-compose workflow so future migrations are automatic