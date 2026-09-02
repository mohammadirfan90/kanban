# Webbriks Kanban — Spec Index

All specs in execution order. Each one is self-contained — paste into Puku as-is.

## Day 1 — Foundation (parallel where possible)

| # | Spec | Files | Parallel? |
|---|------|-------|-----------|
| 1 | `01-database-schema.md` | Prisma schema + migration | — |
| 2 | `02-backend-scaffold.md` | NestJS scaffold | ✅ parallel with #3 |
| 3 | `03-frontend-scaffold.md` | Next.js scaffold | ✅ parallel with #2 |
| 4 | `04-auth-module.md` | JWT register/login | After #1, #2 |

## Day 2 — Core CRUD

| # | Spec | Files | Parallel? |
|---|------|-------|-----------|
| 5 | `05-boards-crud.md` | Boards + sharing | ✅ with #6, #7 |
| 6 | `06-columns-crud.md` | Columns CRUD | ✅ with #5, #7 |
| 7 | `07-tasks-crud.md` | Tasks CRUD | ✅ with #5, #6 |

## Day 3 — Movement & UI

| # | Spec | Files | Parallel? |
|---|------|-------|-----------|
| 8 | `08-task-movement.md` | Move endpoint with fractional indexing | After #7 |
| 9 | `09-board-sharing-ui.md` | Share modal, member list | After #5 |
| 10 | `10-drag-drop-ui.md` | Drag-and-drop kanban board | After #8, #9 |

## Day 4 — Ship

| # | Spec | Files | Parallel? |
|---|------|-------|-----------|
| 11 | `11-docker.md` | Dockerfile + docker-compose | ✅ all three |
| 12 | `12-readme-deployment.md` | README, env files, deploy | ✅ all three |

---

## Dependency graph

```
#1 (schema)
  ├──→ #2 (backend scaffold) ──→ #4 (auth) ──┐
  │                                          ├──→ #5/#6/#7 (CRUD) ──→ #8 (movement)
  │                                          │                              │
  └──→ #3 (frontend scaffold) ──────────────┘                              │
                                                                          ▼
                                                                  #10 (drag-drop UI)
                                                                  #9 (sharing UI)

#11 (docker) and #12 (README) depend on everything above
```

## Conventions across all specs

- **Backend:** NestJS 10, Prisma, PostgreSQL, TypeScript strict mode
- **Frontend:** Next.js 14 (App Router), React, TypeScript strict, **shadcn/ui (required)**, Tailwind, dnd-kit
- **Design contract:** [`/DESIGN.md`](../DESIGN.md) — read FIRST for any frontend spec. Update it when patterns change.
- **Icons:** Lucide React only
- **Toasts:** Sonner
- **Forms:** react-hook-form + zod via shadcn `<Form>`
- **Auth:** JWT (HS256), bcrypt cost 12, 24h TTL
- **Errors:** `{ statusCode, message, error }` format
- **API base:** `/api` prefix on all routes
- **IDs:** UUID v4
- **Naming:** kebab-case files, PascalCase classes, camelCase vars
- **Testing:** Jest (backend), Vitest (frontend)

## How to use these specs

1. Read the spec end-to-end before pasting
2. For frontend specs: read `/DESIGN.md` first — every visual decision comes from there
3. Adjust any field that doesn't match your reality (e.g., specific library versions)
4. Paste into Puku verbatim
5. Review the diff Puku produces — particularly the **DESIGN.md compliance** checklist in Spec 10
6. Update the spec if you learn something — specs are living documents
