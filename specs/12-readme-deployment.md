# Spec 12 — README, Env Files & Deployment

## Goal
Write a polished `README.md` that lets a reviewer set up the project in under 5 minutes, plus create the env example files referenced by Spec 11 and provide a deployment guide for the optional live demo.

## Context
- All other specs complete (Specs 01-11)
- Repo structure: `backend/`, `frontend/`, `specs/`, `docs/`, `DESIGN.md`, `AGENTS.md`, `docker-compose.yml`
- Reviewer will read `README.md` FIRST — it sets their entire impression of the project
- Deployment is **optional but impressive** — include it if you have time

## Inputs
- Stack: NestJS + Prisma + PostgreSQL (backend), Next.js + shadcn/ui (frontend), Docker
- Default ports: backend 3001, frontend 3000, postgres 5432
- Auth: JWT with bcrypt, 24h TTL
- Tech requirements: Node.js 20+, Docker (recommended), PostgreSQL 16

## Outputs

### Root
- `README.md` — primary project documentation (replaces any existing stub)
- `.env.example` — example env for local non-Docker setup
- `.env.docker.example` — example env for Docker setup (created in Spec 11 but README references it)

### Backend
- `backend/.env.example` — comprehensive env template (must match what NestJS ConfigModule reads)

### Frontend
- `frontend/.env.example` — must include `NEXT_PUBLIC_API_URL`

### Deployment guide (in README)
- One section for **Vercel + Railway + Neon** (easiest free tier)
- One section for **single-VPS Docker** (if you have a server)

## Constraints

### `README.md` structure (required sections in order)
```markdown
# Mini Kanban Board

[1-2 sentence tagline]

[Demo GIF or screenshot placeholder]

## Features
- [bullet list of capabilities]

## Tech Stack
[Backend / Frontend / Infra breakdown]

## Quick Start (Docker)
[3-step setup: clone, env, compose up]

## Quick Start (Local Dev without Docker)
[For contributors who want hot-reload]

## Architecture
[Brief overview: schema, API endpoints, frontend structure]

## Environment Variables
[Table or list of all vars with descriptions]

## Scripts
[Make / npm scripts cheatsheet]

## Deployment
[Optional — Vercel/Railway OR VPS]

## Project Structure
[Tree view of folders]

## License
```

### Tone & style
- Confident but not arrogant
- No "we" / "our" — use "this project" or imperative ("Run", "Configure")
- Show, don't tell: a single line of example output > paragraph of explanation
- Every command must be copy-pasteable
- Include expected output for non-obvious commands

### `.env.example` (root, for Docker)
```bash
# Backend
JWT_SECRET=replace-with-32-bytes-of-random-data
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:3000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### `backend/.env.example`
```bash
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://kanban:kanban@localhost:5432/kanban

# Auth
JWT_SECRET=replace-with-32-bytes-of-random-data
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGIN=http://localhost:3000
```

### `frontend/.env.example`
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Quick Start commands (must match exactly what's in docker-compose.yml)
```bash
# Clone
git clone <repo-url>
cd webbriks-kanban

# Configure
cp .env.docker.example .env
# Edit .env: set JWT_SECRET to any random string

# Run
docker compose up --build

# Open
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001/api
```

### Local dev (no Docker) commands
```bash
# 1. Start postgres (assumes Docker for db only)
docker run -d --name kanban-postgres \
  -e POSTGRES_USER=kanban \
  -e POSTGRES_PASSWORD=kanban \
  -e POSTGRES_DB=kanban \
  -p 5432:5432 \
  postgres:16-alpine

# 2. Backend
cd backend
cp .env.example .env
# Edit .env: set DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate dev
npm run start:dev

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

### Architecture section content (concise)
- **Backend:** NestJS modules (Auth, Boards, Columns, Tasks, Prisma). JWT auth, role-based access (OWNER/EDITOR/VIEWER). Prisma for DB.
- **Database:** 5 tables (User, Board, BoardMember, Column, Task). Fractional indexing for task order (no renumbering on move).
- **Frontend:** Next.js App Router. shadcn/ui + Tailwind. dnd-kit for drag-drop. Sonner for toasts. Dark mode via next-themes.
- **Concurrency:** Task moves use fractional position (`Float`), allowing conflict-free reordering without lock contention.

### Deployment: Vercel + Railway + Neon (recommended)
```markdown
## Deployment

### Free-tier setup (~10 min)

**1. Database (Neon)**
- Sign up at https://neon.tech
- Create project, copy the connection string
- Note: add `?sslmode=require` to the URL

**2. Backend (Railway)**
- Sign up at https://railway.app
- New Project → Deploy from GitHub repo
- Set root directory: `backend`
- Add env vars:
  - `DATABASE_URL` (from Neon)
  - `JWT_SECRET` (generate one: `openssl rand -base64 32`)
  - `JWT_EXPIRES_IN=24h`
  - `CORS_ORIGIN=<your-vercel-url>`
  - `PORT=3001`
  - `NODE_ENV=production`
- Add a Start Command override: `npx prisma migrate deploy && node dist/main.js`
- (Build command is auto-detected from package.json)
- Get the deployed URL (e.g., `https://kanban-api.up.railway.app`)

**3. Frontend (Vercel)**
- Sign up at https://vercel.com
- New Project → Import your GitHub repo
- Set root directory: `frontend`
- Add env var:
  - `NEXT_PUBLIC_API_URL=https://kanban-api.up.railway.app/api`
- Deploy

**4. Wire CORS**
- Update backend's `CORS_ORIGIN` env var in Railway to the Vercel URL
- Railway auto-redeploys
```

### Project Structure tree (in README)
```
.
├── backend/                # NestJS API
│   ├── prisma/             # Schema + migrations
│   ├── src/
│   │   ├── auth/
│   │   ├── boards/
│   │   ├── columns/
│   │   ├── tasks/
│   │   ├── prisma/
│   │   └── common/
│   └── Dockerfile
├── frontend/               # Next.js UI
│   ├── src/
│   │   ├── app/            # Routes (App Router)
│   │   ├── components/     # UI components
│   │   ├── lib/            # API client, utils, types
│   │   └── hooks/
│   └── Dockerfile
├── specs/                  # Work specifications (01-12)
├── docs/
│   └── iteration-log.md
├── DESIGN.md               # UI design contract
├── AGENTS.md               # Agent behavior rules
├── docker-compose.yml
└── README.md
```

### Links to include at top of README
- Demo URL (if deployed)
- Screenshots (if available)
- Specs index: brief mention of `/specs/` for full build documentation

## Acceptance Criteria

### README quality
- [ ] Opens with 1-2 sentence tagline + demo link/screenshot
- [ ] Features listed as scannable bullets (5-8 max)
- [ ] Tech stack section with sub-categories (Backend / Frontend / Infra)
- [ ] Quick Start (Docker) works end-to-end on a clean machine in <5 min
- [ ] Quick Start (Local) provides working commands for hot-reload dev
- [ ] Every command in README is copy-pasteable and correct
- [ ] Architecture section explains the 5-table schema, fractional indexing rationale
- [ ] Environment variables section lists ALL vars with descriptions
- [ ] Deployment section provides step-by-step for Vercel + Railway + Neon
- [ ] Project structure tree matches actual repo layout
- [ ] License section (MIT recommended)
- [ ] No typos, no broken markdown rendering
- [ ] Links to DESIGN.md and AGENTS.md for context

### Env files
- [ ] `backend/.env.example` lists every var NestJS ConfigModule reads
- [ ] `frontend/.env.example` includes `NEXT_PUBLIC_API_URL`
- [ ] `.env.example` (root) for Docker lists compose-relevant vars
- [ ] All env files have inline comments explaining each var
- [ ] No actual secrets committed — all use placeholder values

### Deployment instructions
- [ ] Step-by-step for at least one platform (Vercel + Railway + Neon recommended)
- [ ] Commands verified to match the actual service configs
- [ ] Notes on Postgres SSL requirement (`?sslmode=require`) for managed DBs
- [ ] CORS configuration step included
- [ ] Migration command (`prisma migrate deploy`) included in backend start

### Reviewer experience
- [ ] A new reviewer can clone, run `docker compose up`, and use the app without asking questions
- [ ] All "what is X" questions are answered in README or linked from it
- [ ] No 404s, no broken anchor links, no placeholder text

## Out of Scope
- Detailed contribution guidelines (`CONTRIBUTING.md`)
- Code of conduct
- Issue templates
- Changelog (use git log)
- Performance benchmarks
- Architecture decision records (ADRs) — design decisions are already in `/specs/` and `docs/iteration-log.md`
- Custom domain setup for deployment
- Monitoring / observability setup
- Backup strategies for production DB
- Email templates (not in v1 features)