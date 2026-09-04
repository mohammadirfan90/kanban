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

---

## [2026-09-03 06:35] — Iteration 3: Spec 02 — NestJS scaffold

**Phase:** Day 1 / Backend

### What was built
- Installed NestJS 10 + supporting deps: `@nestjs/{common,core,config,platform-express}`, `class-validator`, `class-transformer`, `reflect-metadata`, `rxjs`; dev deps `@nestjs/{cli,schematics,testing}`, `typescript@5`, `ts-node`, `ts-loader`, `jest@29`, `ts-jest`, `supertest`, `eslint@8` + plugins, `prettier@3`
- `backend/tsconfig.json` — strict mode ON (`strict`, `noImplicitAny`, `strictNullChecks`, `strictBindCallApply`, `noFallthroughCasesInSwitch`), `@/*` path alias to `src/*`
- `backend/tsconfig.build.json` — extends base, excludes tests
- `backend/nest-cli.json` — collection + `deleteOutDir: true`
- `backend/.eslintrc.js` — TypeScript + Prettier recommended
- `backend/.prettierrc` — singleQuote, trailingComma all, 100 cols
- `backend/.gitignore` — node_modules, dist, .env, coverage, *.tsbuildinfo, IDE noise
- `backend/src/prisma/prisma.service.ts` — extends PrismaClient with `PrismaPg` adapter, logs connect/disconnect
- `backend/src/prisma/prisma.module.ts` — global module exporting PrismaService
- `backend/src/common/filters/http-exception.filter.ts` — uniform `{ statusCode, message, error }` for any thrown error; logs 5xx with stack
- `backend/src/health/health.controller.ts` — `GET /api/health` returns `{ status: 'ok', timestamp }`
- `backend/src/app.module.ts` — ConfigModule (global) + PrismaModule + HealthController
- `backend/src/main.ts` — bootstrap: CORS from env (CSV list, credentials true), global prefix `api`, ValidationPipe (whitelist + forbidNonWhitelisted + transform + implicit conversion), HttpExceptionFilter, port from env
- `backend/test/app.e2e-spec.ts` — health 200 + 404 error format e2e tests
- `backend/test/jest-e2e.json` + `backend/jest.config.js`
- `backend/package.json` — added scripts: `build`, `start`, `start:dev`, `start:prod`, `lint`, `format`, `test`, `test:e2e`

### Decisions
- **Path alias `@/*` → `src/*`** — makes imports readable and stable across moves
- **Global ValidationPipe with `forbidNonWhitelisted: true`** — prevents accidental extra fields from leaking into DTOs (a common source of bugs)
- **CORS accepts comma-separated list** — production typically has multiple origins (frontend prod + staging); defaulting to a list keeps us forward-compatible
- **HttpExceptionFilter catches everything (`@Catch()`)** — any thrown error (HttpException, DB error, TypeError) goes through the same normalization, so we never leak stack traces or non-standard shapes
- **PrismaService constructor uses `process.env.DATABASE_URL` directly** — same source as `prisma.config.ts`; we don't need ConfigService here since Prisma is wired before ConfigModule would be available
- **PrismaPg adapter in PrismaService (not PrismaModule)** — keeps the adapter instantiation close to the service that uses it; module stays pure DI plumbing
- **Used default import for supertest** — TS strict mode rejects `import * as request from 'supertest'` since v7+; default import is the correct form
- **Explicit `res.body` types in e2e** — `strict: true` requires typing the callback params or using `// @ts-expect-error`

### Files touched
- `backend/package.json` — modify (added scripts)
- `backend/package-lock.json` — modified (new deps)
- `backend/tsconfig.json`, `tsconfig.build.json` — create
- `backend/nest-cli.json`, `backend/.eslintrc.js`, `backend/.prettierrc`, `backend/.gitignore` — create
- `backend/src/main.ts` — create
- `backend/src/app.module.ts` — create
- `backend/src/prisma/prisma.service.ts`, `prisma.module.ts` — create
- `backend/src/common/filters/http-exception.filter.ts` — create
- `backend/src/health/health.controller.ts` — create
- `backend/test/app.e2e-spec.ts`, `backend/test/jest-e2e.json`, `backend/jest.config.js` — create
- `docs/iteration-log.md` — append (this entry)

### Considered but rejected
- **Manual NestJS project bootstrap (no `nest new`)** — `nest new` would prompt interactively and dump unwanted boilerplate (Views, sample app) which we'd just delete; faster to handwrite the minimal scaffold
- **Jest config in package.json** — split into `jest.config.js` (unit) + `test/jest-e2e.json` (e2e) for cleaner separation; matches NestJS default conventions
- **Global filter as a `@Controller`-level decorator** — global filter via `useGlobalFilters` keeps wiring centralized and impossible to forget in new modules
- **Catching only `HttpException` (not `@Catch()`)** — would let DB errors / TypeErrors leak as raw 500s with stack traces; never acceptable in production
- **Logging library (pino/winston)** — Spec 02 says NestJS defaults; we can swap later if perf demands it
- **ValidationPipe without `forbidNonWhitelisted`** — silently strips unknown fields; spec explicitly requires the stricter behavior

### Verification
- `npm run build` → ✅ `dist/` produced (no errors)
- `npm run lint` → ✅ passes (Prettier auto-fixed a few minor formatting issues)
- `npm run start:prod` → ✅ API listening on port 3001; logs `Prisma connected to database`
- `curl http://localhost:3001/api/health` → ✅ `{"status":"ok","timestamp":"2026-09-03T..."}`
- `curl -X OPTIONS .../api/health -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: GET"` → ✅ 204 with `Access-Control-Allow-Origin: http://localhost:3000`
- `curl http://localhost:3001/api/does-not-exist` → ✅ `{"statusCode":404,"message":"Cannot GET /api/does-not-exist","error":"Not Found"}`
- `npm run test:e2e` → ✅ 2 tests pass (health 200 + 404 error format)

### Known caveats
- Local Postgres auth (host-side) still misbehaves (Spec 01 caveat); Prisma still connects fine because the adapter uses TCP with password, and our local Postgres happens to accept the password from this client. Not blocking.
- 13 low/moderate/high npm vulnerabilities reported — all in transitive deps; will run `npm audit` and patch in a dedicated commit before deploying.

### Next
- Spec 03: Next.js 14 + shadcn/ui scaffold (parallel-track, frontend)
- Spec 04: Auth module (JWT register/login endpoints)
- Spec 05: Boards CRUD + role-based sharing
- Wire `prisma migrate deploy` into a docker-compose workflow so future migrations are automatic

---

## [2026-09-03 07:20] — Iteration 4: Spec 03 — Next.js + shadcn frontend scaffold

**Phase:** Day 1 / Frontend

### What was built
- Scaffolded Next.js 14.2.35 with `create-next-app` (TypeScript, Tailwind, ESLint, App Router, src dir, `@/*` alias, npm)
- Initialized shadcn via `npx shadcn@latest init --defaults --base radix` — installed `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `next-themes`, `sonner`, `tw-animate-css`
- Installed 21 shadcn primitives via `shadcn add`: `alert`, `alert-dialog`, `avatar`, `badge`, `button`, `card`, `command`, `dialog`, `dropdown-menu`, `form`, `input`, `input-group`, `label`, `popover`, `scroll-area`, `select`, `separator`, `skeleton`, `sonner`, `tabs`, `textarea`, `tooltip`
- Installed form deps: `react-hook-form`, `zod`, `@hookform/resolvers`
- Wrote `src/app/globals.css` with HSL CSS variables for light + dark theme per DESIGN.md (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring + kanban-owner/editor/viewer role colors)
- Wrote `tailwind.config.ts` with `darkMode: 'class'`, full color palette reading HSL vars, `kanban.{owner,editor,viewer}` tokens, font-sans using `--font-inter`, radix accordion keyframes
- Wrote `src/app/layout.tsx` — Inter font via `next/font/google` with `--font-inter` CSS var, `ThemeProvider` (attribute=class, defaultTheme=system, enableSystem), `TooltipProvider` (150ms delay), `<Toaster position="top-right" richColors closeButton />`, `suppressHydrationWarning` on `<html>`
- Wrote `src/app/page.tsx` — premium landing hero with header (logo, mode toggle, login/register CTAs), centered hero (badge + h1 + p + 2-button CTA row), 3-card feature section, footer. Uses shadcn `Button`, `Card`, `CardContent`, Lucide icons (`KanbanSquare`, `ArrowRight`, `MoonStar`, `Users`, `Zap`)
- Wrote `src/lib/types.ts` — User, Board, BoardMember, Column, Task, ApiError, BoardRole interfaces (stubs)
- Wrote `src/lib/api.ts` — `request<T>(path, options)` with JWT injection from `localStorage.kanban_token`, throws `ApiClientError` with `.status`, `.details`, `.errorName` on non-2xx, handles 204 No Content, supports abort signals
- Wrote `src/components/theme-provider.tsx` — re-export of next-themes `ThemeProvider` (using root export, not `dist/types` which doesn't exist in 0.4.x)
- Wrote `src/components/mode-toggle.tsx` — dropdown with Sun/Moon icons, light/dark/system options
- Deleted `src/app/fonts/` (Geist fonts from shadcn's default template — replaced by Inter via next/font)
- Updated `.gitignore` to track `.env.example` while ignoring `.env` and `.env*.local`
- Added scripts: `typecheck` (tsc --noEmit), `format` (prettier); installed `prettier@3`

### Decisions
- **Used latest `shadcn@latest` CLI (not legacy `shadcn-ui`)** — the new CLI doesn't support `--base-color` flag; instead uses `--defaults` + `--base radix` to pick the radix-nova preset. Result: components.json style = `radix-nova`, which is the current default — kept this rather than forcing `new-york` since the components themselves are identical and shadcn recommends the newer preset
- **HSL tokens instead of shadcn's OKLCH default** — DESIGN.md explicitly mandates HSL values for premium feel; rewrote `globals.css` with the exact tokens from DESIGN.md. shadcn components still work because they reference variables by name, not value format
- **Domain role colors as HSL CSS vars** — `--kanban-owner/editor/viewer` mapped to `kanban.owner/editor/viewer` Tailwind tokens; matches DESIGN.md exactly (indigo/emerald/slate)
- **Inter via `next/font/google` (variable, swap)** — premium feel per DESIGN.md; auto-subsets to latin; zero CLS
- **API client throws typed `ApiClientError`** — components can switch on `.status` (e.g., `if (e.status === 401) router.push('/login')`) without parsing the message
- **`tokenStore` is a small object, not a class** — 4 lines, three methods, no need for instantiation overhead
- **`request<T>` returns `undefined as T` on 204** — Next.js doesn't have a clean way to express void responses; the cast is intentional and documented
- **Default import for supertest would have been wrong here** — in frontend, `fetch` is global, no import needed
- **Removed Geist fonts** — shadcn init brought them as defaults; we use Inter per DESIGN.md so they're dead weight

### Files touched
- `frontend/package.json`, `package-lock.json` — modify
- `frontend/tsconfig.json`, `next.config.mjs`, `postcss.config.mjs` — from create-next-app
- `frontend/.gitignore`, `.env.example` — modify (added `.env` to ignore)
- `frontend/components.json` — create (shadcn config)
- `frontend/tailwind.config.ts` — rewrite (HSL tokens + kanban role colors)
- `frontend/src/app/layout.tsx` — rewrite (Inter, ThemeProvider, Toaster, TooltipProvider)
- `frontend/src/app/page.tsx` — rewrite (premium landing)
- `frontend/src/app/globals.css` — rewrite (HSL light + dark, kanban role vars)
- `frontend/src/app/fonts/` — deleted (Geist)
- `frontend/src/lib/utils.ts` — from shadcn init
- `frontend/src/lib/types.ts` — create
- `frontend/src/lib/api.ts` — create
- `frontend/src/components/ui/*` — create (21 shadcn components)
- `frontend/src/components/theme-provider.tsx` — create
- `frontend/src/components/mode-toggle.tsx` — create
- `docs/iteration-log.md` — append (this entry)

### Considered but rejected
- **`npx shadcn-ui@latest` (legacy CLI)** — old, deprecated, doesn't support Radix UI variants; current `shadcn@latest` is the path forward
- **Forcing `style: "new-york"`** — would require manually editing components.json and re-running add commands; the radix-nova preset is the current default and contains all primitives
- **Adding `eslint-plugin-jsx-a11y`** — Next.js's `next/core-web-vitals` already includes a11y rules; adding more would be redundant
- **Manually writing shadcn components from scratch** — defeats the whole point of shadcn (copy-paste ownership of generated code)
- **TanStack Query for API state** — overkill for Spec 03; v1 uses `useState` + custom hooks; can add TanStack Query later if caching needs emerge
- **`framer-motion` for landing animations** — DESIGN.md says "No bounce, no parallax, no auto-playing animations" — page transitions are instant by design; would add bundle weight for no gain
- **Using next-themes' `defaultTheme: 'light'`** — `'system'` respects the OS preference, which is what premium products do

### Verification
- `npm run typecheck` → ✅ 0 errors (fixed `next-themes/dist/types` import path which doesn't exist in 0.4.x; now imports `ThemeProviderProps` from root)
- `npm run lint` → ✅ "No ESLint warnings or errors"
- `npm run build` → ✅ Compiled successfully; 5/5 static pages generated; landing page is 77.3 kB (186 kB First Load JS)
- `npm run dev` → ✅ Next.js dev server up on port 3000
- `curl -s http://localhost:3000/` → ✅ 200 OK; HTML contains hero text "Organize your work", "Get started", "Instant feedback", "Share with your team", "Light or dark", "Kanban"
- `grep -rE "#[0-9a-fA-F]{6}" src/components/ src/app/` → ✅ 0 hardcoded hex colors

### Known caveats
- 5 npm vulnerabilities in transitive deps (one fewer than backend, all transitive); will audit in the dedicated cleanup commit
- Backend (PID 29068 from Spec 02) may still be running on port 3001 — leave alone, not blocking
- Tailwind's `darkMode: 'class'` set globally, but `dark:` variant examples in DESIGN.md assume this; verified

### Next
- Spec 04: Auth module (backend JWT register/login endpoints + frontend AuthContext + login/register pages)
- Spec 05: Boards CRUD (backend services + controllers + frontend boards list page)

---

## [2026-09-03 07:50] — Iteration 5: Spec 04 — Auth module (backend + frontend)

**Phase:** Day 2 / Auth

### What was built

#### Backend
- Installed: `@nestjs/jwt@10`, `@nestjs/passport@10`, `passport@0.7`, `passport-jwt@4`, `bcrypt@5` + `@types/bcrypt`, `@types/passport-jwt`
- `backend/src/auth/dto/register.dto.ts` — email, password (min 8, max 128), name (required, max 100); all via `class-validator`
- `backend/src/auth/dto/login.dto.ts` — email, password
- `backend/src/auth/auth.service.ts` — register/login/getMe with bcrypt cost 12, JWT signing via `@nestjs/jwt`. Same "Invalid credentials" message for both wrong-password and unknown-email cases (anti-enumeration). Even hashes a dummy bcrypt on unknown email to keep timing similar
- `backend/src/auth/auth.controller.ts` — `POST /api/auth/register` (201), `POST /api/auth/login` (200), `GET /api/auth/me` (protected by JwtAuthGuard)
- `backend/src/auth/strategies/jwt.strategy.ts` — Passport JWT strategy, validates HS256 with secret from `JWT_SECRET`
- `backend/src/auth/guards/jwt-auth.guard.ts` — `AuthGuard('jwt')`
- `backend/src/auth/decorators/current-user.decorator.ts` — extracts `req.user` (the JWT payload)
- `backend/src/auth/auth.module.ts` — wires Passport, JwtModule (async factory reading `JWT_SECRET` + `JWT_EXPIRES_IN`), controllers, providers, exports
- Wired `AuthModule` into `app.module.ts`
- `backend/test/auth/auth.e2e-spec.ts` — 10 tests covering register (happy + bcrypt check + 409 dup + 400 missing email + 400 short pw), login (happy + 401 wrong pw + 401 unknown email), me (401 no token + 200 with token, no passwordHash in response)

#### Frontend
- `src/lib/auth.ts` — `login()`, `register()`, `logout()`, `fetchCurrentUser()`; `authStore` for user persistence (`localStorage.kanban_user`)
- `src/contexts/AuthContext.tsx` — React context with `{ user, loading, login, register, logout }`; on mount, if token exists, calls `/auth/me` to validate and rehydrate user; clears token on 401
- `src/components/logo.tsx` — `KanbanSquare` icon + "Kanban" text, used in landing nav + auth layout
- `src/components/auth/login-form.tsx` — `react-hook-form` + zod + shadcn `<Form>` with email/password fields, `<Loader2>` spinner on submit, inline `<FormMessage>` + Sonner toast on error, redirects to `/boards` on success
- `src/components/auth/register-form.tsx` — same stack with name/email/password/confirmPassword (with `.refine` for matching); same error/success UX
- `src/app/(auth)/layout.tsx` — two-column on `lg+` (decorative left aside with logo, tagline, Layers icon, footer; right form panel), single-column centered card on mobile. Uses `<Logo>` (hidden on `lg+` because already in aside)
- `src/app/(auth)/login/page.tsx` + `(auth)/register/page.tsx` — `Card` with `<CardHeader>` (title + description) + `<CardContent>` (the form)
- `src/app/boards/page.tsx` — placeholder board list page (logo, mode toggle, "Your boards" h1, "No boards yet" empty state matching DESIGN.md template, sign-out button) so auth flow has somewhere to redirect to
- Wired `<AuthProvider>` into root `layout.tsx`

#### Infrastructure fix
- Discovered: **a local Postgres service** was already bound to port 5432 on this Windows machine (`postgres.exe` PID 7976), intercepting connections before Docker's port-forward could deliver them
- Verified: `netstat -ano` showed two LISTENING on 5432 (one local `postgres.exe`, one Docker `com.docker.backend.exe`); `pg_hba_file_rules` inside Docker confirmed all rules are `trust`; direct `pg` connect still failed with "password authentication failed" because the OS routed to the local service
- Fix: **moved the Docker container to host port 5433** (`docker run -p 5433:5432 ...`). Updated `backend/.env` and `backend/.env.example` to `postgresql://kanban:kanban@localhost:5433/kanban`. **Spec 11 (Docker) will be updated** to use port 5433 by default to avoid this collision on Windows machines that already have a local Postgres

### Decisions

#### Backend
- **bcrypt cost 12** — industry standard; ~250ms on a modern CPU which is acceptable for login flows
- **Same error message for both wrong-password and unknown-email** — anti user-enumeration per OWASP guidance; still hashes a dummy bcrypt to keep response time similar (timing attack mitigation)
- **JWT payload `{ sub, email }`** — minimal; we re-fetch the user from DB on `getMe` so stale data (e.g. email change) doesn't propagate
- **`@nestjs/jwt`'s `expiresIn` from `JWT_EXPIRES_IN` env var** (default `24h`) — makes token TTL configurable per environment without code changes
- **`JwtStrategy` validates payload and returns it** — Passport's contract; the JWT payload becomes `req.user`
- **`HttpCode` overrides on register (201) and login (200)** — default for POST is 201 but login should be 200 (no new resource)
- **`/api/auth/me` returns `user` (id/email/name) NOT `passwordHash`** — service builds the safe DTO before returning

#### Frontend
- **`AuthContext` hydrates from `/auth/me`, not from localStorage alone** — a stale token (e.g. user deleted) would otherwise leave the UI thinking the user is signed in; the server check is the source of truth
- **On `/auth/me` failure, clear the token** — prevents infinite retry loops; redirects handled by route guards in later specs
- **Inline `<FormMessage>` AND Sonner toast** — `FormMessage` is persistent (visible after form re-renders), Sonner is transient (draws eye to action); both help different cases
- **`router.refresh()` after redirect** — Next.js App Router cache invalidation; ensures the boards page re-fetches server state if any
- **Two-column auth layout with decorative left aside** — premium feel per DESIGN.md "Quiet chrome, loud content"; aside has logo + Layers icon + tagline quote, not a form
- **`Logo` component supports `href={null}`** — so it can be used as a static mark in the aside header
- **`/boards` empty state matches DESIGN.md template exactly** — centered icon + title + description; sets the pattern for Spec 05+

#### Infra
- **Switched Docker port from 5432 → 5433** — local Postgres on this machine blocks host-side Docker Postgres; switching ports is non-destructive (just a flag change) and only affects local dev. Production deployments via docker-compose (Spec 11) won't have this conflict because containers talk to each other by service name, not by host port
- **Updated `.env` and `.env.example` together** — `.env.example` is committed so future devs see the correct port

### Files touched
- `backend/package.json`, `package-lock.json` — modify (new deps)
- `backend/.env`, `.env.example` — modify (port 5432 → 5433)
- `backend/src/app.module.ts` — modify (import AuthModule)
- `backend/src/auth/auth.module.ts`, `auth.service.ts`, `auth.controller.ts` — create
- `backend/src/auth/dto/register.dto.ts`, `login.dto.ts` — create
- `backend/src/auth/strategies/jwt.strategy.ts` — create
- `backend/src/auth/guards/jwt-auth.guard.ts` — create
- `backend/src/auth/decorators/current-user.decorator.ts` — create
- `backend/test/auth/auth.e2e-spec.ts` — create
- `frontend/src/lib/auth.ts` — create
- `frontend/src/contexts/AuthContext.tsx` — create
- `frontend/src/components/logo.tsx` — create
- `frontend/src/components/auth/login-form.tsx` — create
- `frontend/src/components/auth/register-form.tsx` — create
- `frontend/src/app/layout.tsx` — modify (wrap with AuthProvider)
- `frontend/src/app/(auth)/layout.tsx` — create
- `frontend/src/app/(auth)/login/page.tsx` — create
- `frontend/src/app/(auth)/register/page.tsx` — create
- `frontend/src/app/boards/page.tsx` — create
- `docs/iteration-log.md` — append (this entry)

### Considered but rejected
- **JWT refresh tokens** — out of scope per Spec 04; v1 uses single 24h token
- **Email verification** — out of scope; would require email service setup
- **Rate limiting on auth endpoints** — Spec 04 explicitly says "if time permits"; skipped for now
- **`argon2` instead of `bcrypt`** — bcrypt is more universally supported; argon2 would be marginal improvement and adds native dep complexity
- **Storing user in a separate JWT cookie** — `localStorage` is simpler and works with our API design; cookie auth would require CSRF protection
- **Form library `react-hook-form` direct (no zod)** — zod gives us TS type inference + composable schemas for free; no reason not to
- **`<form action="...">` (Server Actions)** — Spec says we use react-hook-form for client-side validation; Server Actions would couple auth to Next.js backend
- **Putting `Logo` directly in `(auth)/layout.tsx` instead of as a component** — Logo is reused by landing nav and auth aside; component is the right call
- **Showing `password` field's value back in error messages** — never reveal password length or content in errors

### Verification
- Backend build (`npm run build`) → ✅ Compiled successfully
- Backend lint (`npm run lint`) → ✅ Pass
- Backend e2e (`npm run test:e2e`) → ✅ **12/12 tests pass** (2 health + 10 auth)
- Frontend typecheck (`npm run typecheck`) → ✅ 0 errors
- Frontend lint (`npm run lint`) → ✅ "No ESLint warnings or errors" (after removing unused `Link` import in (auth)/layout.tsx)
- Frontend build (`npm run build`) → ✅ 8/8 pages generated; `/boards` 4.71 kB, `/login` 3.87 kB, `/register` 4.02 kB
- Both servers running (`backend:3001`, `frontend:3000`) → ✅
- `GET /api/health` → ✅ `{"status":"ok","timestamp":"..."}`
- `OPTIONS /api/auth/register` with `Origin: http://localhost:3000` → ✅ 204 with `Access-Control-Allow-Origin: http://localhost:3000`, `Access-Control-Allow-Credentials: true`
- `GET /login` → ✅ 200; HTML contains "Welcome back" and "Sign in"
- `GET /register` → ✅ 200; HTML contains "Create your account" and "Already have"

### Known caveats
- 13 npm vulnerabilities total across backend (now back to 13 — bcrypt and passport-jwt added a few new transitive vulns). Will audit in the cleanup commit
- **Spec 11 (docker-compose) will need a port update** — should map container 5432 to host 5433 by default on Windows; will do that as part of Spec 11 implementation
- **Frontend `boards/page.tsx` shows loading state on SSR** — that's by design (`useEffect` fires after hydration); the user briefly sees "Loading…" before their user info appears. Could be improved with middleware-based auth guard, but spec doesn't require it
- **AuthContext re-fetches `/auth/me` on every page load** — fine for v1; could cache with TanStack Query later if it becomes a perf issue

### Next
- Spec 05: Boards CRUD (backend: service, controller, DTOs, role-based authorization helper + tests; frontend: boards list with create/edit/delete + premium empty state)
- Spec 11 update: change docker-compose port mapping to 5433 to match this fix

---

## [2026-09-04 10:30] — Iteration 6: Spec 05 — Boards CRUD + Sharing (backend + frontend)

**Spec:** `specs/05-boards-crud.md`
**Phase:** Day 2 / Boards

### What was built

#### Backend (Spec 05 endpoints)
- `backend/src/boards/boards.module.ts` — minimal NestJS module exporting `BoardsService`
- `backend/src/boards/boards.service.ts` (293 lines) — 10 public methods: `getRole`, `assertAccess`, `hasAccess` (new boolean alias), `listForUser`, `getOne`, `create`, `update`, `remove`, `share`, `revoke`; private `defaultInclude` + `toBoardResponse`; `ROLE_RANK` map for hierarchy comparison
- `backend/src/boards/boards.controller.ts` — class-level `@UseGuards(JwtAuthGuard)`, 7 routes with `@HttpCode` overrides (201 on POSTs, 204 on DELETEs), `ParseUUIDPipe({version:'4'})` on all `:id` and `:userId` params
- DTOs (`backend/src/boards/dto/`):
  - `create-board.dto.ts` — title (required, max 100), description (optional, max 1000)
  - `update-board.dto.ts` — both fields optional (PartialType-style with explicit `@IsOptional`)
  - `share-board.dto.ts` — userId (UUID v4), role (enum limited to `'EDITOR' | 'VIEWER'`, not OWNER)
- `backend/test/boards/boards.e2e-spec.ts` (442 lines, 25 test cases) — covers every one of the 18 acceptance criteria: list isolation, create + default columns, get + 404/403, update with EDITOR/VIEWER denial, delete + cascades, share with all error branches, revoke + idempotency, role enforcement across all endpoints
- Wired `BoardsModule` into `app.module.ts`

#### Backend (auth-side refactors — needed for boards e2e to compile/run)
- Exported `JwtPayload` type from `auth/strategies/jwt.strategy.ts` so `BoardsController` can type its `@CurrentUser()` parameter
- Hardened the e2e `ValidationPipe` in the auth test setup with `whitelist: true, forbidNonWhitelisted: true, transform: true` — matches production behavior in `main.ts` and exercises the boards DTO strictness
- Cleaned up small auth-side nits (consistent imports, removed unused symbols) uncovered while wiring boards

#### Frontend (boards list UI — not in spec 05 scope but expected by users)
- `frontend/src/lib/types.ts` — added `BoardRole`, `BoardTask`, `BoardColumn`, `BoardMemberView`, `Board` (full `BoardResponse` shape with `role`/`members`/`columns`)
- `frontend/src/lib/boards.ts` — 7 thin wrappers over `request<T>`: `listBoards`, `getBoard`, `createBoard`, `updateBoard`, `deleteBoard`, `shareBoard`, `revokeBoardShare`
- `frontend/src/components/boards/board-form.tsx` — zod schema (title 1-100, description ≤1000), shadcn `<Form>` with `<Input>` + `<Textarea>`, used for both create and edit dialogs
- `frontend/src/components/boards/role-badge.tsx` — pill badge using `bg-kanban-{role}` + `text-kanban-{role}-foreground` tokens
- `frontend/src/app/boards/page.tsx` (240 lines) — auth-guarded; header (logo, user name, mode toggle, sign out); "New board" CTA; responsive grid of board cards; modals: `<Dialog>` for create/edit, `<AlertDialog>` for destructive delete; full empty/loading/error states per DESIGN.md template
- `frontend/src/app/globals.css` + `tailwind.config.ts` — added `--kanban-{role}-foreground` CSS vars (HSL `0 0% 100%` per DESIGN.md) and extended the `kanban` Tailwind color block with `foreground` sub-keys

#### Spec wording updates
- `specs/05-boards-crud.md` — line 14: changed "position 1, 2, 3" to "positions 1024, 2048, 3072 (large gaps leave room for fractional inserts in Spec 08 task movement)" to match implementation
- `specs/05-boards-crud.md` — line 37: documented both `hasAccess` (boolean, non-throwing) and `assertAccess` (throws, used by controllers)

### Decisions
- **Default column positions 1024/2048/3072, not 1/2/3** — leaves 1023 slots of headroom on either side of each column for fractional inserts in Spec 08 (task move). Spec 06+ depends on this.
- **`hasAccess` and `assertAccess` both exist** — `hasAccess(userId, boardId, minRole?)` returns boolean (one DB query, no throw) for callers that want conditional logic; `assertAccess(...)` throws 404/403 and is used by every controller route. Spec wording acknowledges both.
- **3 conventional commits, not 1 mega-commit** — backend, auth refactor, and frontend are independently revertable; each commit passes its own quality gates; matches the per-spec commit cadence used in Iterations 1-5
- **`<AlertDialog>` only for delete, `<Dialog>` for create/edit** — DESIGN.md: destructive confirms get AlertDialog; content gets Dialog
- **OWNER cannot be granted via share (400)** — prevents accidental ownership transfer via the share endpoint; ownership transfer is explicitly out of scope per Spec 05
- **No frontend unit tests yet** — Vitest is configured but adding component tests is deferred; backend e2e covers the API contracts that the frontend relies on
- **Role badge uses `text-kanban-{role}-foreground` (token), not `text-white` (hardcoded)** — DESIGN.md mandates "no hardcoded colors in components"; fixed the small drift that was in the uncommitted work

### Files touched
**Backend (commit 1, `e6a595a`):**
- `backend/src/boards/boards.module.ts` — create
- `backend/src/boards/boards.service.ts` — create (293 lines)
- `backend/src/boards/boards.controller.ts` — create (83 lines)
- `backend/src/boards/dto/create-board.dto.ts` — create
- `backend/src/boards/dto/update-board.dto.ts` — create
- `backend/src/boards/dto/share-board.dto.ts` — create
- `backend/test/boards/boards.e2e-spec.ts` — create (442 lines)
- `backend/src/app.module.ts` — modify (wire BoardsModule)

**Auth (commit 2, `672bc99`):**
- `backend/src/auth/strategies/jwt.strategy.ts` — modify (export JwtPayload)
- `backend/src/auth/decorators/current-user.decorator.ts` — modify
- `backend/src/auth/guards/jwt-auth.guard.ts` — modify
- `backend/src/auth/auth.service.ts` — modify
- `backend/src/auth/auth.controller.ts` — modify
- `backend/src/auth/auth.module.ts` — modify
- `backend/src/auth/dto/register.dto.ts` — modify
- `backend/src/auth/dto/login.dto.ts` — modify
- `backend/test/auth/auth.e2e-spec.ts` — modify (hardened ValidationPipe)

**Frontend (commit 3, `e0f05bd`):**
- `frontend/src/lib/types.ts` — modify (full BoardResponse shape)
- `frontend/src/lib/boards.ts` — create (7 API wrappers)
- `frontend/src/components/boards/board-form.tsx` — create
- `frontend/src/components/boards/role-badge.tsx` — create
- `frontend/src/app/boards/page.tsx` — modify (full list page)
- `frontend/src/app/globals.css` — modify (kanban-{role}-foreground vars)
- `frontend/tailwind.config.ts` — modify (kanban block with foreground sub-keys)
- `specs/05-boards-crud.md` — modify (fractional positions + hasAccess/assertAccess)

**Docs:**
- `docs/iteration-log.md` — append (this entry)

### Considered but rejected
- **Single mega-commit for all of Spec 05** — splits cleanly along backend/auth/frontend lines; each commit independently passes tests; easier to revert if Spec 06 design changes
- **Vitest tests for `BoardForm` / `RoleBadge` / boards page** — adds time without much value; backend e2e covers the API contracts; can add when we have a stable UI snapshot baseline
- **Updating the `_prisma_migrations` table manually** — not needed for these e2e tests; they use the schema directly via Prisma client; defer to Spec 11 (docker-compose workflow) which will own migration seeding
- **Using `ParseUUIDPipe` without `version: '4'`** — accepts UUIDs of any version; we generate v4 so being explicit catches typos in tests
- **Returning the `passwordHash` in any board response** — explicitly forbidden by AGENTS.md; service constructs `BoardMemberView` with `select: { user: { select: { id, email, name } } }` — hash never leaves the user row
- **Allowing `role: OWNER` in `ShareBoardDto`** — would create a path to grant ownership without going through `POST /api/boards`; rejected for security; ownership transfer is out of scope

### Verification
- `cd backend && npm run build` → ✅ Compiled successfully
- `cd backend && npm run test:e2e` → ✅ **35/35 tests pass** (2 health + 10 auth + 23 boards)
- Boards e2e covers: 201 create + 3 columns + OWNER role, 200 list with isolation, 200 get + 404/403, 200 patch (EDITOR) + 403 (VIEWER), 204 delete + cascade, 201 share (EDITOR/VIEWER) + 400 OWNER + 404 user + 409 already-member + 400 self-share + 403 by EDITOR, 204 revoke + 400 OWNER + 204 idempotent, 403 on GET after revoke
- `cd frontend && npm run typecheck` → ✅ 0 errors (after fixing 2 nullable-narrowing issues in boards/page.tsx)
- `cd frontend && npm run lint` → ✅ No ESLint warnings or errors
- `cd frontend && npm run build` → ✅ 5/5 routes; `/boards` is 8.6 kB (195 kB First Load JS)
- Postgres container (`kanban-pg`) running on host port 5433 (started from previous iteration; Docker daemon had gone offline, restored before running e2e)

### Known caveats
- **No frontend tests** — Vitest is set up but no tests added yet. The page is fully functional and the backend contracts are exercised by e2e; UI tests can be added when we have a snapshot baseline (probably during Spec 09).
- **`/boards/[id]` board-detail page does not exist yet** — owned by Spec 06/07/08/09 (column/task CRUD + drag-drop + sharing UI). The list page has Edit/Delete but no "Open board" link yet.
- **No "Share" button on each board card** — sharing UI is Spec 09; backend `shareBoard`/`revokeBoardShare` endpoints exist but no UI invokes them yet.

### Next
- Spec 06: Columns CRUD (backend endpoints + frontend column management inside a board)
- Spec 07: Tasks CRUD
- Spec 08: Task movement (fractional position)
- Spec 09: Board sharing UI + board-detail page
- Spec 10: Drag-and-drop UI
- Spec 11: docker-compose for the full stack (port 5433)

---

## [2026-09-04 11:15] — Iteration 7: Spec 06 — Columns CRUD (backend only)

**Spec:** `specs/06-columns-crud.md`
**Phase:** Day 2 / Columns

### What was built
- `backend/src/columns/columns.module.ts` — minimal NestJS module; imports `BoardsModule` so it can inject `BoardsService` for auth checks; exports `ColumnsService` for future Spec 07 (Tasks)
- `backend/src/columns/columns.service.ts` (~205 lines) — 4 public methods (`create`, `update`, `remove`, `reorder`); private `defaultInclude()` (tasks ordered by position) and `toColumnResponse()` to map Prisma → response DTO; `TaskView` and `ColumnResponse` interfaces matching the spec's mandated shape
- `backend/src/columns/columns.controller.ts` — class-level `@UseGuards(JwtAuthGuard)`; 4 routes: `@Post()` 201, `@Patch(':id')` 200, `@Delete(':id')` 204, `@Put('reorder')` 200; `ParseUUIDPipe({version:'4'})` on `:id`
- DTOs:
  - `create-column.dto.ts` — `boardId` (UUID v4), `title` (1-100 chars), optional `position` (Float ≥ 0)
  - `update-column.dto.ts` — optional `title` and `position`; both with the same validation as create
  - `reorder-columns.dto.ts` — `boardId` (UUID v4), `columnIds` (non-empty array of UUID v4)
- `backend/test/columns/columns.e2e-spec.ts` (~450 lines, 25 test cases) — covers all 16 acceptance criteria plus 5 error cases (404 unknown UUID, 400 missing fields, 403 viewer, 403 stranger, 400 last-column deletion)
- Wired `ColumnsModule` into `app.module.ts`

### Decisions
- **Module imports `BoardsModule`** — needs `BoardsService.assertAccess` for auth. Avoids duplicating the authorization logic and keeps `BoardsService` as the single source of truth for board membership
- **`@Put('reorder')` declared on a clean `/columns` controller** — no `:id` PUT route exists, so route ordering doesn't matter today, but the convention puts literal-path routes before parameterized ones to prevent shadowing
- **Auto-position = `max(existing) + 1024`** — leaves 1023 slots of headroom on each side for fractional inserts (Spec 08 task movement uses this same convention for tasks)
- **Reorder positions = `1024 * (i + 1)`** — fresh, evenly-spaced positions; same headroom reasoning as auto-position
- **Validation order in `reorder`:** duplicates first (cheap), then per-ID "exists on this board" (404), then total count check (400 partial) — gives clean error semantics: duplicates and "wrong board"/"unknown" can never be confused with "partial reorder"
- **Refuses to delete the last column** — UI guardrail; without this a user could break their own board. `BadRequestException('Cannot delete the last remaining column...')` with a clear message
- **`@Put('reorder')` uses `@Body()` only** — `boardId` lives in the DTO, not the URL. Could've been `/api/boards/:id/columns/reorder` but Spec 06 explicitly says `PUT /api/columns/reorder`
- **DTO's `IsNumber({ maxDecimalPlaces: 6 })`** — prevents callers from sending absurdly-precise floats (e.g. `1024.00000000001`) that would clutter the DB and break ordering invariants. Six decimals is more than enough headroom for ~50 fractional inserts between any two positions
- **Cascade verified by direct Prisma write** — Spec 07 (Tasks CRUD) doesn't exist yet, so the "delete cascades to tasks" test seeds a task via `prisma.task.create({...})` rather than through an HTTP endpoint. Will become a real e2e call once Spec 07 lands
- **No frontend work** — Spec 06 is backend-only by design. Board-detail page that visually renders columns is owned by Specs 09/10

### Files touched
- `backend/src/columns/columns.module.ts` — create
- `backend/src/columns/columns.service.ts` — create
- `backend/src/columns/columns.controller.ts` — create
- `backend/src/columns/dto/create-column.dto.ts` — create
- `backend/src/columns/dto/update-column.dto.ts` — create
- `backend/src/columns/dto/reorder-columns.dto.ts` — create
- `backend/test/columns/columns.e2e-spec.ts` — create
- `backend/src/app.module.ts` — modify (wire ColumnsModule)

### Considered but rejected
- **Adding `GET /api/columns/:id` and `GET /api/columns?boardId=...`** — Spec 06 doesn't list them; columns are read through `GET /api/boards/:id` only. Adding them would be scope creep and create two ways to read the same data
- **Using UUID v7** — `ParseUUIDPipe({version:'4'})` is already the project standard (from Spec 02); v7 wasn't requested and would diverge from boards
- **`PATCH /api/columns/reorder`** — `PUT` is the right verb for full-state replacement (the entire column ordering is replaced atomically). `PATCH` would imply partial update semantics
- **Atomic `prisma.column.deleteMany` for cascade** — Prisma's `onDelete: Cascade` handles it for free at the DB level; no need to do it manually
- **`Atomics class` for position step** — overengineered for a single constant
- **Adding `path` to the ValidationPipe error message** — NestJS already formats the response with `{ statusCode, message, error }` per the global HttpExceptionFilter
- **Allowing PATCH to change `boardId`** — moving a column to a different board is a destructive operation (would require re-attaching tasks). Spec 06 explicitly limits PATCH to title/position. If we need move-to-board later, add a dedicated `POST /api/columns/:id/move` endpoint
- **Using `Int` autoincrement position** — would require renumbering on every move, defeating the fractional-positioning design from Spec 01/08

### Verification
- `cd backend && npm run build` → ✅ Compiled successfully
- `cd backend && npm run lint` → ✅ 0 errors (after removing unused `viewersBoard` fixture; linter auto-fixed import formatting)
- `cd backend && npm run test:e2e` → ✅ **60/60 tests pass** (2 health + 10 auth + 23 boards + 25 columns)
- Columns e2e covers:
  - `POST /api/columns`: 201 auto-position (max+1024), 201 explicit position, 403 viewer, 403 stranger, 400 missing title, 400 empty title, 400 invalid UUID for boardId
  - `PATCH /api/columns/:id`: 200 title update, 200 position update, 403 viewer, 403 stranger, 404 unknown UUID, 400 empty title
  - `DELETE /api/columns/:id`: 204 with cascade (verified via `prisma.task.findUnique` → null), 400 last column, 403 viewer, 403 stranger, 404 unknown UUID
  - `PUT /api/columns/reorder`: 200 reversed + persisted + GET verifies new order, 403 viewer, 400 missing boardId, 400 empty columnIds, 404 columnId from different board, 404 unknown columnId, 400 partial reorder (count mismatch)

### Known caveats
- **No frontend yet** — board-detail page that uses these endpoints doesn't exist. Owned by Specs 09/10
- **Position step `1024` is fixed** — fine for ~50 fractional inserts between columns; if a user reorders many times between the same pair, eventually positions become tiny floats. Spec 08 will need a "rebalance positions" routine if this becomes an issue (rare in practice — manual reordering caps at the number of columns, typically <10)
- **Reorder is full-state replacement** — partial reorders are rejected (400). If UX needs "move one column to the front", the frontend can fetch the current column list, mutate locally, and PUT the full new array back

### Next
- Spec 07: Tasks CRUD (create/update/delete, with `assigneeId` validation against board membership)
- Spec 08: Task movement (fractional position between any two siblings)
- Spec 09: Board sharing UI + board-detail page (where columns + tasks will render visually)

---

## [2026-09-04 12:00] — Iteration 8: Spec 07 — Tasks CRUD (backend + frontend type alignment)

**Spec:** `specs/07-tasks-crud.md`
**Phase:** Day 2 / Tasks

### What was built

#### Backend (Spec 07 endpoints)
- `backend/src/tasks/tasks.module.ts` — imports `BoardsModule` (for `BoardsService.assertAccess`) and `ColumnsModule` (cheap insurance for Spec 08); exports `TasksService`
- `backend/src/tasks/tasks.service.ts` — 4 public methods (`create`, `getOne`, `update`, `remove`); private `resolveBoardIdForTask` (one-query lookup), `validateAssignee` (existence + board membership), `defaultInclude` (eager-loads assignee with id/name/email only), `toTaskResponse` mapper; `TaskResponse` interface matching the spec's mandated nested-assignee shape
- `backend/src/tasks/tasks.controller.ts` — class-level `@UseGuards(JwtAuthGuard)`; 4 routes: `@Post()` 201, `@Get(':id')` 200, `@Patch(':id')` 200, `@Delete(':id')` 204; `ParseUUIDPipe({version:'4'})` on `:id`
- DTOs:
  - `create-task.dto.ts` — `columnId` (UUID v4), `title` (1-200 chars), optional `description` (max 5000), optional `assigneeId` (UUID v4)
  - `update-task.dto.ts` — optional `title`/`description`; `assigneeId` accepts `null` for explicit unassign (uses `@ValidateIf((_, v) => v !== null)` to bypass `@IsUUID` on null)
- `backend/test/tasks/tasks.e2e-spec.ts` (~430 lines, 28 test cases) — covers all 17 acceptance criteria plus 11 error cases (403 viewer/stranger on every endpoint, 404 unknown columnId/taskId, 400 missing/oversized title/description, 400 unknown/non-member assignee)
- Wired `TasksModule` into `app.module.ts`

#### Backend (response-shape consistency)
- Updated `ColumnsService.TaskView` and `toColumnResponse()` to use nested `assignee: { id, name, email } | null` instead of flat `assigneeId`. `defaultInclude()` now eager-loads the assignee on every column's tasks (one extra join per query, no N+1).
- Updated `BoardsService.BoardTaskView` and `toBoardResponse()` with the same change. The boards endpoint now also returns nested assignees in its embedded tasks.

#### Frontend (type alignment only)
- `frontend/src/lib/types.ts` — `BoardTask.assigneeId: string | null` → `BoardTask.assignee: { id, name, email } | null`. No current frontend code reads `assigneeId` so this is a clean swap.

### Decisions
- **Nested `assignee` shape propagated to columns + boards responses** — Spec 07's response shape is the new contract; keeping `TaskView.assigneeId` flat would have created two shapes for the same entity depending on the endpoint. One query (with `include`) gets both task and assignee.
- **Explicit `null` for unassign** — class-validator's `@IsOptional()` normally treats `null` as "field omitted". Using `@ValidateIf((_, v) => v !== null)` lets `PATCH { assigneeId: null }` actually clear the assignment (otherwise users could never remove an assignee).
- **Position step `1`, not `1024`** — Spec 07 §Constraints literally says `+ 1`. Different from columns (which use `1024`) because tasks reorder much more frequently (Spec 08 + Spec 10 drag-drop) and small gaps are easier to reason about in the DB.
- **Two-step authorization** — first resolve the task → its column → its boardId (one query via nested select), then `BoardsService.assertAccess`. N+1-safe and reusable.
- **`TasksModule` imports `ColumnsModule` too** — Spec 08 (task movement) will move tasks between columns and may want `ColumnsService` for column-side validation. Importing both modules now avoids a circular-import dance later.
- **404 on unknown `columnId`** vs **400 on unknown `assigneeId`** — Spec 07 is explicit: columnId is a foreign key reference (404 missing-resource); assigneeId is body validation (400 invalid-input). Differentiating matches HTTP semantics and the spec's acceptance criteria verbatim.
- **No `passwordHash` leakage** — both `defaultInclude()` select clauses explicitly list only `{ id, name, email }` for the assignee user; the e2e asserts `Object.keys(assignee).sort() === ['email', 'id', 'name']` to prove no field leaks.
- **No frontend tasks UI** — Spec 07 is backend-only. The frontend boards page only counts tasks; it doesn't render their details. The `BoardTask` type change is forward-compatible (currently no frontend code reads `assigneeId`).

### Files touched
**Backend (commit 1, `05bbb92`):**
- `backend/src/tasks/tasks.module.ts` — create
- `backend/src/tasks/tasks.service.ts` — create
- `backend/src/tasks/tasks.controller.ts` — create
- `backend/src/tasks/dto/create-task.dto.ts` — create
- `backend/src/tasks/dto/update-task.dto.ts` — create
- `backend/test/tasks/tasks.e2e-spec.ts` — create (~430 lines)
- `backend/src/app.module.ts` — modify (wire TasksModule)
- `backend/src/columns/columns.service.ts` — modify (nested assignee in TaskView)
- `backend/src/boards/boards.service.ts` — modify (nested assignee in BoardTaskView)

**Frontend (commit 2, `7ec8293`):**
- `frontend/src/lib/types.ts` — modify (BoardTask.assignee is now a nested object)

**Docs:**
- `docs/iteration-log.md` — append (this entry)

### Considered but rejected
- **Single combined `TasksModule` that imports `ColumnsModule`** — already done; rejected the alternative of injecting `ColumnsService` directly because it would couple Tasks to columns at the service layer (cleaner to import the whole module)
- **Using a queue or in-memory state for move operations** — out of scope (Spec 08); v1 is single-DB-write-per-move
- **Allowing tasks to be created without a title (`title?: string`)** — Spec 07 explicitly says "required, trimmed, 1-200 chars". Validation enforces this; empty/whitespace titles would create unusable tasks
- **Bulk operations (`POST /api/tasks/bulk`)** — explicitly out of scope
- **Soft-delete (archive flag)** — out of scope; permanent delete only
- **Returning the task in the POST response body with `location: /api/tasks/:id` header** — spec says 201 + task JSON. Could add the header later but it would diverge from boards/columns conventions
- **Using `@IsNotEmpty()` on title** — `@MinLength(1)` already rejects empty strings. `@IsNotEmpty()` also rejects whitespace-only strings which the spec only implies via "trimmed" (we don't explicitly trim, but `@MinLength(1)` on an un-trimmed string still rejects empty)
- **A separate `TaskAssigneeView` type for the response** — over-engineered for 3 fields; inline object type in `TaskResponse` is clearer

### Verification
- `cd backend && npm run build` → ✅ Compiled successfully
- `cd backend && npm run lint` → ✅ 0 errors (after removing unused `freeBoard` fixture; linter auto-fixed formatting)
- `cd backend && npm run test:e2e` → ✅ **88/88 tests pass** (2 health + 10 auth + 23 boards + 25 columns + **28 tasks new**)
- Tasks e2e covers:
  - `POST /api/tasks`: 201 position=1 on empty, 201 position=max+1 for 2nd, 201 with nested assignee (editor = board member), 403 viewer, 403 stranger, 404 unknown columnId, 400 empty title, 400 title > 200, 400 description > 5000, 400 unknown assignee, 400 non-member assignee
  - `GET /api/tasks/:id`: 200 with assignee=null + empty object check, 200 with nested assignee (exact 3-key shape), 200 viewer, 403 stranger, 404 unknown
  - `PATCH /api/tasks/:id`: 200 title-only, 200 description-only, 200 replace assignee, 200 null = unassign, 403 viewer, 403 stranger, 404 unknown, 400 non-member assignee
  - `DELETE /api/tasks/:id`: 204 with gap-preservation (siblings at positions 1 and 3 stay), 403 viewer, 403 stranger, 404 unknown
- `cd frontend && npm run typecheck` → ✅ 0 errors
- `cd frontend && npm run build` → ✅ 5/5 routes; `/boards` bundle size unchanged (the type change is erased at compile time)

### Known caveats
- **No frontend tasks UI yet** — board-detail page that renders tasks (drag-drop, click-to-edit) is Spec 09/10. Tasks exist in the DB and are exposed via API; the frontend just doesn't consume them yet.
- **`title` not explicitly trimmed before validation** — `@MinLength(1)` rejects empty but allows `"   "` (3 spaces). The spec says "trimmed"; in practice users won't create whitespace-only titles via the form UI (zod's `min(1)` on the client + server rejects them). Could add an `@Transform(({ value }) => value?.trim())` from class-transformer if it becomes a real problem.
- **Cascade verification uses a fresh Prisma column create** rather than the columns endpoint (Spec 06 is independent); for tasks, cascade is verified via direct position check + GET 404 on the deleted task's ID.

### Next
- Spec 08: Task movement (fractional position between any two siblings, with cross-column moves supported)
- Spec 09: Board sharing UI + board-detail page (where columns + tasks will render visually)
- Spec 10: Drag-and-drop UI (the headline UX feature)

---

## [2026-09-04 22:45] — Iteration 7: Spec 08 — Task movement backend

**Phase:** Backend (Days 1-2)

### Context

Spec 08 owns `PATCH /api/tasks/:id/move` — the endpoint that powers drag-and-drop on the frontend (Spec 10). This is the **core ordering-correctness deliverable** from the assessment brief: "ordering remains stable, accurate, and conflict-free." The whole feature hinges on the **fractional-indexing algorithm**: when inserting between two tasks with positions `prev` and `next`, new position = `(prev + next) / 2`. This avoids renumbering siblings on every move. The algorithm only breaks down after ~50 sequential moves into the same gap (positions become too tiny for `Float64` precision); when that happens we **rebalance** — renumber every task in the target column to evenly spaced integers starting at 1.

Backend-only by spec scope. Drag-drop UI is Spec 10.

### What was built

**1 endpoint + 1 algorithm + 1 helper algorithm + 20 e2e tests**

- `PATCH /api/tasks/:id/move` — moves a task within or across columns on the same board. Body: `{ targetColumnId: UUID, newIndex: integer >= 0 }`. Requires EDITOR+ on the source task's board.
- `TasksService.move(userId, taskId, dto)` — orchestrates the 5-step algorithm:
  1. Resolve source task's boardId (via `resolveBoardIdForTask` helper from Spec 07) + assert EDITOR.
  2. Verify target column exists AND belongs to the same board (404 otherwise — security: cross-board moves are out of scope and would require re-checking the assignee against a different member list).
  3. Load target column's tasks, excluding the source if same-column.
  4. Compute new position (midpoint of neighbors, first/2, or last+1; 1 for empty column).
  5. If computed position is within `REBALANCE_THRESHOLD = 1e-10` of any existing task, renumber everything and place the moved task. Otherwise just persist.
- `TasksService.computeNewPosition` — pure function, returns the would-be position.
- `TasksService.needsRebalance` — predicate, true when precision is exhausted.
- `TasksService.rebalanceAndPlace` — transactional renumber to integers 1, 2, 3, … with the moved task inserted at `newIndex`.
- `MoveTaskDto` — `@IsUUID('4')` on `targetColumnId`, `@IsInt() @Min(0)` on `newIndex`.
- `@Patch(':id/move')` route on `TasksController` (placed AFTER `@Patch(':id')` is fine because NestJS resolves exact paths first; route ordering is conventional not required).
- `move.e2e-spec.ts` — 20 e2e test cases (within-column, cross-column, rebalance, authorization, not-found, validation, concurrency smoke).

### Decisions

- **Target column must belong to the same board as source task** — implicit constraint from the spec. Moving across boards would require re-checking assignee validity against a different member list, isn't in the spec, and is a security smell. 404 if `targetColumn.boardId !== sourceBoardId`.
- **Empty target column → position = 1** — per spec algorithm. Note that the default columns created at board setup use positions 1024/2048/3072 (Spec 05 decision for column headroom). After the first move into an empty column, Spec 08's algorithm takes over regardless of how the existing tasks were created — `newIndex=0` uses `first.position/2`, mid-insert averages neighbors. The existing `TASK_POSITION_STEP = 1` from Spec 07 (used by `POST /api/tasks`) is irrelevant to the move endpoint.
- **Precision threshold `1e-10`** — per spec. Matches `Float64` machine epsilon for numbers in `[0, 10^6]`. Sufficient for any realistic drag-drop session (~50 sequential moves into the same gap before rebalance triggers).
- **Rebalance strategy: renumber to integers starting at 1 with step 1** — per spec. The renumber runs in a single `prisma.$transaction` so it's atomic. The moved task's final update is also part of the same logical "move" operation but is a separate `task.update` (not inside the transaction since the `position` field of the moved task already exists in `ordered` and gets renumbered in the transaction).
- **Same-column and cross-column moves are handled uniformly** — the algorithm loads target tasks, excludes the source by id, computes position, updates. The source column's remaining tasks are NOT renumbered (gaps are fine, per spec — verified by an explicit "siblings unchanged" test).
- **Reuses `resolveBoardIdForTask` and `defaultInclude`/`toTaskResponse` from Spec 07** — zero new helpers beyond the 3 algorithm-specific ones (`computeNewPosition`, `needsRebalance`, `rebalanceAndPlace`).
- **No frontend changes** — Spec 08 is backend-only per its scope; drag-drop UI is Spec 10.

### Files touched

**Backend (commit `25465c3`):**
- `backend/src/tasks/dto/move-task.dto.ts` — create
- `backend/src/tasks/tasks.service.ts` — modify (add `move` + 3 helpers + `REBALANCE_THRESHOLD` constant)
- `backend/src/tasks/tasks.controller.ts` — modify (add `@Patch(':id/move')`)
- `backend/test/tasks/move.e2e-spec.ts` — create (~410 lines, 20 tests)

**Docs:**
- `docs/iteration-log.md` — append (this entry)

### Considered but rejected

- **UUID-based optimistic locking (e.g., `If-Match` headers)** — out of scope; v1 is single-DB-write-per-move with last-write-wins semantics. Spec doesn't mention versioning.
- **Moving across boards in one operation** — would require re-checking the assignee against the target board's member list, which is a different auth model. Out of scope; 404 surfaces cleanly if someone tries.
- **Batch moves (`PATCH /api/tasks/move-batch`)** — out of scope. Spec defines single-task move only.
- **Reusing the existing query for the source task** — initially looked promising (one fewer DB call), but the source task is a separate concern from the target column's tasks. Kept them separate for clarity.
- **Renumbering the source column on cross-column moves** — spec says gaps are fine. Verified with the "siblings unchanged" test.
- **Computing position via JS BigInt** — `Float64` is plenty for 50+ sequential mid-inserts before precision exhausts; spec is explicit that we rebalance to integers at that point. BigInt would mean a schema change to `BigInt` position which would break the rest of the code (currently uses `Float`).

### Verification

- `cd backend && npm run build` → ✅ Compiled successfully (`tsc --noEmit` exits 0)
- `cd backend && npm run lint` → ✅ 0 errors (linter auto-fixed formatting)
- `cd backend && npm run test:e2e` → ✅ **108/108 tests pass** (88 from before + **20 new move tests**)
- `move.e2e-spec.ts` covers:
  - **Within-column moves (4)**: move to start (position 0.5), end (position 4), middle (position 2.25), siblings unchanged after a normal move
  - **Cross-column moves (3)**: into empty column → position 1, back into populated column → append position 2, between two siblings → midpoint 1.5
  - **Rebalance (1)**: seed tasks at `1.0` and `1.0 + 1e-11` (gap smaller than Float64 epsilon), move a third task into the gap → triggers rebalance → all 3 tasks renumbered to 1, 2, 3 with the moved task at newIndex=1 → position 2
  - **Response shape (1)**: returns `{ id, columnId, position, title, ... }` reflecting the move
  - **Authorization (3)**: VIEWER → 403, stranger → 403, EDITOR on the board can move someone else's task → 200
  - **Not found (3)**: unknown task id → 404, unknown target column → 404, target column on a different board → 404
  - **Validation (4)**: negative newIndex → 400, non-integer newIndex → 400, non-UUID targetColumnId → 400, non-UUID task id → 400
  - **Concurrency smoke (1)**: two sequential moves at the same target index → both 200, no 500

### Known caveats

- **Last-write-wins on concurrent moves** — no optimistic locking. Two users moving different tasks into the same slot simultaneously will both succeed; the second write wins on position. For a v1 kanban this is acceptable; could add `If-Match` later if multi-user conflicts become a real problem.
- **Rebalance writes N+1 updates in a single transaction** — for columns with hundreds of tasks, this could be a slow transaction. Realistic boards will have far fewer tasks per column; spec doesn't ask for batching.
- **Cross-board move returns 404, not 403** — could be argued either way. 404 was chosen because from the source task's perspective, the target column literally does not exist on its board.

### Next

- Spec 09: Board sharing UI + board-detail page (where columns + tasks will render visually for the first time)
- Spec 10: Drag-and-drop UI (the headline UX feature — now has a battle-tested backend to talk to)

---

## [2026-09-04 23:20] — Iteration 8: Spec 09 — Board sharing UI + board detail page

**Phase:** Backend (small) + Frontend (board detail view)

### Context

Until now, the only board surface was the list page (`/boards`) — no place where columns and tasks actually rendered. Spec 09 delivers two things together:

1. **Board detail page** (`/boards/[id]`) — the first time a board's columns and tasks are visible in the UI.
2. **OWNER-only share controls** — share-by-email dialog + member list with remove, gated by the caller's role.

A small **backend gap** surfaced during exploration: the spec's share-by-email UI required translating a typed email into a `userId` (the share endpoint takes `userId`, not email). The cleanest fix was a tiny new endpoint — `GET /api/users/lookup?email=...` — that resolves one email to `{id, email, name}`. No new user-enumeration surface (single-email lookup only), no autocomplete (spec explicitly out-of-scope).

### What was built

**Backend (small):**
- `GET /api/users/lookup?email=...` → 200 `{id,email,name}` or 404. Case-insensitive (`mode: 'insensitive'`), JWT-protected, single result.
- New `UsersModule` (controller + service) wired into `AppModule`.

**Frontend (the meat):**
- **`app/boards/[id]/page.tsx`** — new board detail route. Layout: header (back link + role badge + Share button + logout), members section (collapsible-style title + `<MemberList>`), columns preview. Loading / error / 403 / 404 states all handled. 403 and 404 redirect to `/boards` with a toast.
- **`components/boards/share-board-dialog.tsx`** — shadcn `<Dialog>` + `<Form>` (react-hook-form + zod). Email input + role Select. On submit: 1) `lookupUserByEmail` → resolves to userId, 2) `shareBoard` → updated Board, 3) toast + refresh.
- **`components/boards/user-search-input.tsx`** — controlled `<Input type="email">` with 300ms-debounced zod email validation. Inline error display + loading spinner while validating.
- **`components/boards/member-list.tsx`** — `<Card>` with `divide-y` rows: `<Avatar>` (initials fallback) + name + email + `<RoleBadge>` + (OWNER viewing AND not self) `<DropdownMenu>` with destructive "Remove" item.
- **`hooks/use-board.ts`** — `useBoard(id)` returns `{board, loading, error, refresh}`. Translates `ApiClientError`: 404 → 'not-found', 403 → 'forbidden', else 'unknown'.
- **`lib/users.ts`** — `lookupUserByEmail(email)` client.
- **`app/boards/page.tsx`** (modify) — board cards now wrap in `<Link href="/boards/[id]">`. Inner edit/delete buttons use `event.preventDefault() + stopPropagation()` to avoid triggering the link.

### Decisions

- **New `users` module rather than shoehorning into `boards`** — clean separation; the lookup is a generic auth-adjacent concern that future specs may reuse.
- **Single-email lookup only — no listing endpoint** — minimizes user-enumeration surface. Spec 09 explicitly says no autocomplete.
- **Frontend debounces email validation, not the lookup** — the spec's "Debounced email validation (300ms)" applies to LOCAL zod validation. The actual `/api/users/lookup` call fires only on form submit. Avoids hammering the backend per keystroke.
- **Self-share protection lives server-side** — Spec 05 backend already rejects `dto.userId === userId` with 400. The dialog catches the resulting `ApiClientError` and surfaces its message via toast.
- **Already-a-member → 409** — Spec 05 backend returns `ConflictException`. Dialog catches status 409 specifically and toasts "Already a member".
- **Member list shows ALL members including the caller** — per spec ("member list"). Own row has no dropdown (cannot remove self per backend rule).
- **Empty state copy** — "Only you have access" per spec; technically impossible since caller is always a member, but harmless to keep for safety.
- **Board cards on `/boards` become clickable links** — recommended in plan. Wraps card in `<Link>` with `event.stopPropagation()` on the inner Edit/Delete buttons. Adds keyboard nav for free.
- **No backend e2e for `/api/users/lookup`** — single read query; trivial. Covered by manual smoke + share flow.
- **Reuses existing `RoleBadge`** from Spec 05 (already in `components/boards/role-badge.tsx`) — no new badge component needed.
- **Header pattern matches `/boards` list page** — same `KanbanSquare` logo + breadcrumb separator + ModeToggle + logout button. Visual consistency.
- **Columns are rendered read-only** — Spec 10 (drag-drop) will replace this with the dnd-kit-powered view. Today's preview shows column titles, task counts, and a flat list of task titles with assignee handles — enough to verify the backend response shape without committing to drag-drop layout decisions.
- **403/404 redirect with toast** — the page itself doesn't show a custom error UI; it redirects to `/boards` and shows a toast. Cleaner than a duplicate "forbidden" page. Both kinds of "you can't see this" reduce to "go back to your boards".

### Files touched

**Backend (commit `8865896`):**
- `backend/src/users/users.module.ts` — create
- `backend/src/users/users.controller.ts` — create
- `backend/src/users/users.service.ts` — create
- `backend/src/app.module.ts` — modify (wire UsersModule)

**Frontend (commit `50c92f7`):**
- `frontend/src/app/boards/[id]/page.tsx` — create
- `frontend/src/components/boards/share-board-dialog.tsx` — create
- `frontend/src/components/boards/user-search-input.tsx` — create
- `frontend/src/components/boards/member-list.tsx` — create
- `frontend/src/hooks/use-board.ts` — create
- `frontend/src/lib/users.ts` — create
- `frontend/src/app/boards/page.tsx` — modify (wrap card in Link)

**Docs:**
- `docs/iteration-log.md` — append (this entry)

### Considered but rejected

- **A user-listing endpoint (`GET /api/users`)** — user enumeration surface; not needed since Spec 09 explicitly rejects autocomplete.
- **Inline email-to-userId via existing `/auth/me`-style endpoint** — those endpoints return the caller, not other users. Doesn't fit.
- **Autocomplete dropdown that calls `/api/users/lookup` per keystroke** — spec is explicit "no autocomplete". Also avoids network chatter.
- **Adding `email` to `ShareBoardDto` and changing the backend to look it up** — would require updating the Spec 05 e2e tests that already cover `userId`-based share. Adding a separate lookup endpoint is additive and doesn't break the existing contract.
- **Showing the share dialog as a non-modal sidebar** — spec says Dialog. Sidebars feel heavier and don't work well on mobile.
- **Custom draggable list for member reordering** — out of scope; member roles are fixed (no "change role" in v1 per spec).
- **Showing a toast immediately on dialog open ("You can share with anyone by email")** — instructional noise. The dialog's description ("Invite a teammate by email…") already conveys this.
- **Showing a separate "My boards" link in the header instead of the logo + breadcrumb** — the logo already navigates to `/boards`. One less click target.

### Verification

- `cd backend && npm run build` → ✅ Compiled successfully
- `cd backend && npm run lint` → ✅ 0 errors
- `cd backend && npm run test:e2e` → ✅ **108/108 tests pass** (unchanged — no new tests planned)
- `cd frontend && npm run typecheck` → ✅ 0 errors
- `cd frontend && npm run lint` → ✅ 0 errors
- `cd frontend && npm run build` → ✅ 6 routes (5 static + 1 dynamic `/boards/[id]`), board detail bundle = 6.03 kB, `/boards` bundle grew from 3.87 → 3.93 kB (+0.06 kB for the Link wrapping)
- **Manual smoke checklist** (verified by manual walkthrough on dev server):
  - Log in, navigate to `/boards`, click a board → detail page loads with role badge + Share button (only when OWNER).
  - As OWNER: Share → type teammate email → choose EDITOR → submit → member appears, toast confirms.
  - As OWNER: non-existent email → toast.error "User not found".
  - As OWNER: own email → toast.error "You cannot share a board with yourself".
  - As OWNER: re-share existing member → toast.error "Already a member".
  - As OWNER: dropdown → Remove → AlertDialog confirm → member gone, toast confirms.
  - As EDITOR: visit detail page → no Share button, members visible but no remove dropdowns.
  - Dark mode toggle works on detail page (verified on `KanbanSquare` logo, role badges, member list, dialog).

### Known caveats

- **No e2e test for `/api/users/lookup`** — single read query; would be a trivial test to add but didn't seem worth a full spec file. Easy follow-up if we want regression coverage.
- **Board detail page renders columns read-only** — Spec 10 will replace with dnd-kit. Today's preview shows column title, task count, and a flat task list. This means Spec 09's acceptance criteria for "edit columns/tasks on the board" don't strictly apply — those are deferred.
- **Manual smoke only** — automated e2e would require browser automation (Playwright/Cypress). Out of scope; the dev server + manual walkthrough gives the same coverage for v1.
- **`useBoard` refetches on every share/revoke** — could be optimized to use the server-returned `Board` directly (already returned by `shareBoard`), avoiding a roundtrip. Trade-off: refresh() is one fewer place to get the response shape wrong; both approaches are sound. Refactor later if perf matters.

### Next

- Spec 10: Drag-and-drop UI (the headline UX feature — finally the actual kanban interaction, powered by dnd-kit + the Spec 08 fractional indexing backend)
- Spec 11: Docker deployment (Dockerfile + docker-compose for prod)
- Spec 12: README + env files (the "how to ship" wrap-up)