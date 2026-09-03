# Spec 11 — Docker Setup

## Goal
Containerize the backend, frontend, and PostgreSQL database so the entire stack runs locally with a single `docker-compose up` command. Make the dev experience fast and the reviewer setup frictionless.

## Context
- Backend (NestJS) lives in `backend/` (Specs 01, 02, 04-08 complete)
- Frontend (Next.js) lives in `frontend/` (Specs 03, 04, 09, 10 complete)
- Database: PostgreSQL 16 (Prisma schema in Spec 01)
- This is Day 4 work but should be planned alongside Spec 12 (README) so setup instructions match the actual compose file
- Reviewer should be able to clone the repo and run `docker compose up` to get a working app

## Inputs
- Backend `package.json` with scripts: `build`, `start`, `start:dev`, `prisma:generate`, `prisma:migrate`
- Frontend `package.json` with scripts: `dev`, `build`, `start`
- Existing `.env.example` files in both `backend/` and `frontend/`
- Postgres connection expected at `postgresql://kanban:kanban@postgres:5432/kanban` from inside Docker network

## Outputs

### Root
- `docker-compose.yml` (at repo root)
- `docker-compose.override.yml` — optional dev-only overrides (volume mounts for hot reload) — may be optional
- `.env.docker.example` — example env file for Docker setup (copy to `.env` to run compose)
- `.dockerignore` (at repo root, applies to both build contexts)

### Backend
- `backend/Dockerfile` — multi-stage (deps → builder → runner)
- `backend/.dockerignore`

### Frontend
- `frontend/Dockerfile` — multi-stage (deps → builder → runner)
- `frontend/.dockerignore`
- `frontend/next.config.mjs` — must add `output: 'standalone'` for production Docker build (modify if not already)

## Constraints

### `docker-compose.yml` (3 services)
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: kanban
      POSTGRES_PASSWORD: kanban
      POSTGRES_DB: kanban
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kanban"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://kanban:kanban@postgres:5432/kanban
      JWT_SECRET: ${JWT_SECRET:-dev-secret-change-me}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-24h}
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:3000}
      PORT: 3001
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "3001:3001"
    # On startup: run prisma migrate deploy then start node
    command: sh -c "npx prisma migrate deploy && node dist/main.js"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:3001/api}
    environment:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:3001/api}
      NODE_ENV: production
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
```

### Backend Dockerfile (multi-stage)
```dockerfile
# Stage 1: deps
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Stage 2: builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 3: runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
USER nestjs
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

### Frontend Dockerfile (multi-stage)
```dockerfile
# Stage 1: deps
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# Stage 3: runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
```

### `.env.docker.example`
```bash
JWT_SECRET=change-me-in-production-use-32-bytes-of-random
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### `.dockerignore` (root + per-service)
Include:
- `node_modules`
- `dist`
- `.next`
- `.git`
- `*.log`
- `.env` (use `.env.example` / `.env.docker.example` instead)
- `temp-docs/`
- `.puku-cli/`
- `.agents/`
- `.venv-pdf/`
- `coverage/`

### Backend migrations
- `command` in compose runs `npx prisma migrate deploy` BEFORE starting node
- This ensures the DB schema is up-to-date on first run
- Initial migration must exist in `backend/prisma/migrations/` (created in Spec 01)

### Frontend standalone mode
- `next.config.mjs` must have `output: 'standalone'` for the Docker build to work
- This generates a minimal `server.js` in `.next/standalone`

### Health checks
- Postgres: `pg_isready` (shown above)
- Backend: optional `curl http://localhost:3001/api/health` (skip if it complicates)
- Frontend: optional (skip for v1)

### Volumes
- Postgres data persisted in named volume `postgres_data` (survives `docker compose down`)
- Source code NOT mounted by default (production-style build)
- For dev with hot reload, use `docker-compose.override.yml` (optional, document in README)

## Acceptance Criteria

### Setup works
- [ ] `docker compose up --build` from repo root builds all 3 services
- [ ] Postgres becomes healthy within 10s
- [ ] Backend runs migrations on first start (creates tables)
- [ ] Backend starts on port 3001
- [ ] Frontend starts on port 3000
- [ ] Frontend can reach backend (CORS configured correctly)
- [ ] User can register, log in, create a board via the UI

### Persistence
- [ ] `docker compose down` does NOT delete data (volume persists)
- [ ] `docker compose down -v` DOES delete data (named volume removed)
- [ ] After `down` + `up`, existing user accounts still exist

### Cleanliness
- [ ] Images built are < 500MB each (Alpine-based)
- [ ] `.dockerignore` excludes `node_modules`, `.git`, `.env`, `temp-docs/`
- [ ] Both Dockerfiles use multi-stage builds (no devDependencies in final image)
- [ ] Final containers run as non-root user (`nestjs`, `nextjs`)
- [ ] No secrets hardcoded in Dockerfiles — all via env vars

### Documentation
- [ ] `.env.docker.example` documents all required env vars with safe defaults
- [ ] README (Spec 12) explains Docker setup as the primary setup method

### Edge cases
- [ ] If `JWT_SECRET` is missing, backend fails fast with clear error
- [ ] If Postgres isn't healthy, backend retries (not infinite hang)
- [ ] Re-running `docker compose up --build` after code changes works
- [ ] Stopping with Ctrl+C cleanly shuts down all services

## Out of Scope
- Kubernetes / Helm charts
- Production deployment configs (covered by Spec 12)
- CI/CD pipelines
- Docker Swarm / multi-host setups
- SSL/TLS termination (handled at reverse proxy in deployment)
- Hot-reload dev mode in Docker (use `npm run dev` locally without Docker instead)
- Multi-arch builds (amd64 only is fine for review)