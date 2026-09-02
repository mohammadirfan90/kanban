# Spec 02 — Backend Scaffold (NestJS)

## Goal
Scaffold a NestJS 10 backend with TypeScript strict mode, project conventions, and the base configuration needed to build the Kanban API.

## Context
- Backend will live in `backend/` directory
- Database layer is Prisma (see Spec 01 — schema must exist before this scaffold)
- Will host modules: Auth, Boards, Columns, Tasks
- API will be consumed by the Next.js frontend (Spec 03)

## Inputs
- `backend/` directory is empty (or doesn't exist yet)
- PostgreSQL is available via `DATABASE_URL` env var
- Node.js 20+, npm or pnpm available

## Outputs
- `backend/package.json` with scripts: `start`, `start:dev`, `build`, `test`, `test:e2e`, `lint`, `format`
- `backend/tsconfig.json` with strict mode enabled
- `backend/tsconfig.build.json`
- `backend/nest-cli.json`
- `backend/.eslintrc.js` (or `eslint.config.mjs`)
- `backend/.prettierrc`
- `backend/.gitignore` (node_modules, dist, .env, coverage)
- `backend/.env.example` (PORT, DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, CORS_ORIGIN)
- `backend/src/main.ts` — bootstrap on port from env, enable CORS, global ValidationPipe
- `backend/src/app.module.ts` — import ConfigModule, PrismaModule
- `backend/src/prisma/prisma.module.ts` — global PrismaService provider
- `backend/src/prisma/prisma.service.ts` — extends PrismaClient, OnModuleInit/OnModuleDestroy
- `backend/src/common/filters/http-exception.filter.ts` — uniform error format `{ statusCode, message, error }`
- `backend/test/app.e2e-spec.ts` — placeholder health check test

## Constraints
- Use `nest new` output as a starting point, then customize
- **TypeScript strict mode ON** (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`)
- **ValidationPipe** configured globally with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- **CORS:** origin from `CORS_ORIGIN` env var (default `http://localhost:3000`), credentials true
- **Global prefix:** `api` (all routes prefixed with `/api`)
- Prisma module must be **global** (no need to re-import in each feature module)
- Use **class-validator** and **class-transformer** for DTOs
- ESLint + Prettier with NestJS defaults
- All async route handlers must return Promises
- Module structure: feature folders (`auth/`, `boards/`, `columns/`, `tasks/`, `prisma/`, `common/`)

## Acceptance Criteria
- [ ] `npm run start:dev` starts server on configured port without errors
- [ ] `GET /api/health` returns `{ status: 'ok' }`
- [ ] Prisma connects to DB on startup (check logs)
- [ ] CORS allows requests from configured origin
- [ ] Invalid request body returns 400 with format `{ statusCode: 400, message: [...], error: 'Bad Request' }`
- [ ] Unknown route returns 404 in same error format
- [ ] `npm run build` produces `dist/` without errors
- [ ] `npm run lint` passes with no errors
- [ ] `npm test` runs the placeholder e2e test successfully

## Out of Scope
- Implement any business modules (auth, boards, etc. — separate specs)
- Docker setup (Spec 11)
- Deployment configuration (Spec 12)
- Logging library setup beyond NestJS defaults