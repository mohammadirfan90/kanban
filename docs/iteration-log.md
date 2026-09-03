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