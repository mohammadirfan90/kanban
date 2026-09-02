# Spec 04 — Auth Module (Backend + Frontend)

## Goal
Implement token-based authentication: user registration and login on the backend (NestJS), plus **premium shadcn-based** login/register pages and token storage on the frontend (Next.js).

## Context
- Backend uses NestJS 10 with Prisma (Spec 01, 02 complete)
- Frontend uses Next.js 14 App Router with shadcn/ui (Spec 03 complete — all primitives installed)
- **UI must conform to `/DESIGN.md`** — Inter font, CSS variable tokens, Sonner toasts, premium feel
- This is the **foundation for all protected routes** — every CRUD spec depends on this
- JWT signed with HS256, 24h TTL, secret from `JWT_SECRET` env var
- Form library: `react-hook-form` + `zod` (via shadcn `<Form>` component)
- Toast library: `sonner`

## Inputs
- Backend: `User` model exists in Prisma schema with `id, email, passwordHash, name, createdAt, updatedAt`
- Frontend: `lib/api.ts` has `request<T>(path, options)` function with auth header support
- Env vars: `JWT_SECRET`, `JWT_EXPIRES_IN` (default `24h`), `CORS_ORIGIN`

## Outputs

### Backend
- `backend/src/auth/auth.module.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/strategies/jwt.strategy.ts`
- `backend/src/auth/guards/jwt-auth.guard.ts`
- `backend/src/auth/guards/current-user.decorator.ts` — extracts `req.user`
- `backend/src/auth/dto/register.dto.ts` — email, password (min 8), name
- `backend/src/auth/dto/login.dto.ts` — email, password
- `backend/test/auth/auth.e2e-spec.ts`

### Frontend
- `frontend/src/app/(auth)/login/page.tsx` — login page using shadcn `Card`, `Form`, `Input`, `Button`
- `frontend/src/app/(auth)/register/page.tsx` — register page using shadcn `Card`, `Form`, `Input`, `Button`
- `frontend/src/app/(auth)/layout.tsx` — centered `Card` layout with logo + tagline
- `frontend/src/app/(auth)/auth-illustration.tsx` — subtle decorative SVG or gradient panel (left side on `lg+`, hidden on mobile)
- `frontend/src/lib/auth.ts` — `login()`, `register()`, `logout()`, `getToken()`, `getUser()`
- `frontend/src/contexts/AuthContext.tsx` — provides `user`, `login`, `register`, `logout`, `loading`
- `frontend/src/components/auth/login-form.tsx` — `react-hook-form` + zod + shadcn `<Form>` + Sonner toast on success/error
- `frontend/src/components/auth/register-form.tsx` — same stack, with confirm-password validation
- `frontend/src/components/logo.tsx` — simple SVG/typographic logo (used in nav + auth)

## Constraints
- **Backend:**
  - Endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` (protected)
  - bcrypt cost factor **12**
  - JWT payload: `{ sub: userId, email }`
  - **Same error message** for "user not found" and "wrong password" (avoid user enumeration)
  - Validate DTOs with class-validator (email format, password min length 8)
  - Never return `passwordHash` in any response
  - Register returns `{ access_token, user: { id, email, name } }`
  - Login returns same shape
  - `GET /api/auth/me` returns the current user from JWT
  - `JwtAuthGuard` reads `Authorization: Bearer <token>` header
- **Frontend:**
  - Store token in `localStorage` under key `kanban_token`
  - Store user in `localStorage` under key `kanban_user`
  - `AuthContext` exposes `{ user, login, register, logout, loading }`
  - On 401 response from API, clear token + redirect to `/login`
  - Login form: email, password, submit button, link to /register
  - Register form: name, email, password (min 8), confirm password, submit, link to /login
  - Form validation: client-side checks before submit (zod schema), server errors displayed inline via shadcn `<FormMessage>`
  - Successful login → `toast.success("Welcome back, {name}")` + redirect to `/boards`
  - Successful register → `toast.success("Account created")` + redirect to `/boards`
  - Failed login → `toast.error("Invalid credentials")` + inline error
  - All forms use **shadcn `<Form>` (react-hook-form + zod)** — NOT plain HTML form elements
  - All inputs use **shadcn `<Input>`** with `<Label>` above
  - Submit button uses shadcn `<Button>` with `<Loader2>` spinner while pending: `<Button disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign in</Button>`
  - Auth layout (`(auth)/layout.tsx`):
    - Two-column on `lg+`: left side decorative (subtle gradient or SVG), right side form card
    - Single-column centered card on mobile
    - Logo + tagline at top of form card
    - Background: `bg-background`, card: shadcn `<Card>` with `shadow-sm`
  - **Premium feel checklist (per DESIGN.md):**
    - Inter font applied
    - Generous spacing (`space-y-4` between fields, `p-6` card padding)
    - Label above input (NOT placeholder-as-label)
    - Focus ring visible on inputs
    - All colors via tokens — no hex codes
    - Dark mode works

## Acceptance Criteria

### Backend
- [ ] `POST /api/auth/register` with valid body returns 201 + `{ access_token, user }`
- [ ] Duplicate email returns 409
- [ ] Missing email returns 400 with validation error
- [ ] Password < 8 chars returns 400
- [ ] `POST /api/auth/login` with valid creds returns 200 + `{ access_token, user }`
- [ ] Wrong password returns 401 with message "Invalid credentials"
- [ ] Non-existent email returns 401 with SAME message "Invalid credentials"
- [ ] `GET /api/auth/me` without token returns 401
- [ ] `GET /api/auth/me` with valid token returns user object (no passwordHash)
- [ ] All passwords in DB are bcrypt-hashed (verify by inspecting one record)
- [ ] E2E test in `auth.e2e-spec.ts` covers happy path + 4 error cases

### Frontend
- [ ] `/register` page renders shadcn `<Form>` with email/password/name fields, submits, redirects to `/boards` on success
- [ ] `/login` page renders shadcn `<Form>` with email/password fields, submits, redirects to `/boards` on success
- [ ] Token persists in localStorage across reloads
- [ ] `AuthContext` provides user state to all child components
- [ ] Invalid credentials show inline `<FormMessage>` AND Sonner error toast
- [ ] Form clears after successful submission
- [ ] Submit button shows `<Loader2>` spinner and is disabled while pending
- [ ] Auth layout matches DESIGN.md: two-column on `lg+`, centered card on mobile, logo + tagline
- [ ] All forms use shadcn primitives (no raw `<input>` or `<button>`)
- [ ] All colors come from CSS variables — no hardcoded hex
- [ ] Inter font renders correctly
- [ ] Dark mode toggle changes colors seamlessly
- [ ] Focus rings visible when tabbing through form
- [ ] No console errors, no hydration warnings

## Out of Scope
- Password reset / forgot password
- Email verification
- OAuth (Google, GitHub)
- Refresh tokens
- "Remember me" / persistent sessions beyond 24h
- Rate limiting (will add separately if time permits)
- Two-factor auth