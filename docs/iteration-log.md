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