# AGENTS.md — Project Conventions for AI Agents

This file is the **source of truth for how AI agents should behave in this repository**. It is read by Puku CLI and any other agentic tool configured for this project.

Update this file whenever you learn a new convention or make a decision that future agents should know about.

---

## 🏗️ Project Structure

```
F:/AIProjects/webbrikstest/
├── DESIGN.md              # UI design contract (read for any frontend work)
├── AGENTS.md              # This file
├── .gitignore             # Ignores .puku, .agents, .puku-cli, temp-docs/
├── specs/                 # All work specifications (01-10)
├── docs/
│   └── iteration-log.md   # Append-only build log
├── temp-docs/             # Gitignored: PDF briefs, reference materials
├── backend/               # NestJS API (Specs 01, 02, 04-08)
└── frontend/              # Next.js UI (Specs 03, 04, 09, 10)
```

---

## 📚 Required Reading Before Any Work

Before starting any task, an agent MUST read these files (in this order):
1. `/AGENTS.md` (this file)
2. `/DESIGN.md` (for any frontend task)
3. The relevant spec in `/specs/`

If the agent reads only the spec and skips DESIGN.md or this file, the output will violate project conventions.

---

## 🔧 Tech Stack (Do Not Deviate Without Discussion)

### Backend
- **Runtime:** Node.js 20+
- **Framework:** NestJS 10
- **ORM:** Prisma
- **Database:** PostgreSQL 16
- **Language:** TypeScript with `strict: true`
- **Auth:** `@nestjs/jwt` + `@nestjs/passport` + `bcrypt` (cost 12)
- **Validation:** `class-validator` + `class-transformer`
- **Testing:** Jest

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript with `strict: true`
- **Styling:** Tailwind CSS **v4** only (no CSS modules, no styled-components).
  There is no `tailwind.config.ts` — the theme lives in `frontend/src/app/globals.css`
  (`@theme inline`). shadcn components must be v4-era; v3-era ones will silently lose
  utilities. Animations come from `tw-animate-css`, imported at the top of `globals.css`.
- **Components:** **shadcn/ui exclusively** (Radix + Tailwind). No Material/Chakra/MUI/Bootstrap.
- **Icons:** Lucide React (no emoji as functional icons)
- **Toasts:** Sonner
- **Forms:** react-hook-form + zod via shadcn `<Form>`
- **Drag-and-drop:** @dnd-kit/core + @dnd-kit/sortable
- **Theme:** next-themes (light + dark mode)
- **Font:** Inter via `next/font/google`
- **Testing:** Vitest

---

## 🚫 Hard Rules

These are non-negotiable. If an agent violates them, the user will reject the work.

### Git
- **Always ask before `git commit`.** (Already enforced globally via `~/.puku-cli/settings.json` — the commit prompt will fire.)
- **Commit messages: one-line only.** No multi-paragraph commits. No body. No footer.
- **NEVER include `Co-Authored-By: Puku` or `Co-Authored-By: Claude` in any commit message or PR description.** (Already enforced globally.)
- **Commit messages MUST use conventional commit type prefix.** Format: `<type>: <subject>`. Types:
  - `feat` — a new feature for the user (correlates with MINOR in SemVer)
  - `fix` — a bug fix for the user (correlates with PATCH in SemVer)
  - `docs` — changes to documentation
  - `style` — formatting, missing semi-colons, etc.; no production code change
  - `refactor` — refactoring production code, e.g. renaming a variable
  - `perf` — a code change that improves performance
  - `test` — adding missing tests or correcting existing tests
  - `chore` — updating build tasks, package manager configs, etc.
  - `ci` — changes to CI configuration files and scripts
  - `build` — changes that affect the build system or external dependencies
- **Subject after the prefix** is short (≤72 chars total line), imperative mood ("add", not "added"), no trailing period, lowercase.
- Examples: `feat: add task move endpoint`, `fix: correct owner delete cascade`, `docs: update iteration log`, `chore: bump prisma to 7.10.0`
- Never amend a commit unless explicitly asked.
- Never force-push to main.

### Code
- **No emoji as functional icons.** Use Lucide. (Decorative emoji in empty states is OK.)
- **No gradients** in production UI (except subtle dark-mode hero if needed).
- **No hardcoded colors** in components — use Tailwind tokens / CSS variables only.
- **No `bg-blue-500` or default Tailwind colors** — use the configured `primary` token.
- **No unverified Tailwind classes.** Tailwind drops what it cannot parse without any
  error. After adding or upgrading a shadcn component, confirm its utilities reached
  `frontend/.next/static/css/*.css` before trusting the render.
- **shadcn v4 primitives need `forwardRef` on React 18.** The `ui/` components target
  React 19, where `ref` is a plain prop; on React 18 a function component silently
  drops it. If you pass a `ref` to a `ui/` component, make sure that component wraps
  `React.forwardRef` — otherwise the ref is null with no error. This is what made
  drag-and-drop non-functional (dnd-kit never received the card's DOM node).
- **A response type on the client is not proof the server sends the field.** The board
  API omitted `columnId` on nested tasks while the frontend type declared it, so every
  read was `undefined` and both sides type-checked. Assert response shapes in e2e.
- **Every `ui/` component that a Radix `asChild` trigger wraps needs `forwardRef`.**
  `PopoverTrigger`/`DropdownMenuTrigger`/`TooltipTrigger` render a `Slot` that passes a
  ref to the child. Without forwarding, Floating UI never measures the anchor and the
  popover mounts off-screen with `open === true` and no error.
- **Do not mutate board state for within-column drag previews.** dnd-kit's sorting
  strategy already opens the gap with transforms. Mutating state there loops —
  move changes layout, layout changes the hover target, which moves it back — until
  React aborts with error #185 and unmounts the board mid-drag.
- **Nested task responses come from `common/task-view.ts`.** Boards, columns and tasks
  share one include and one mapper; do not hand-roll a fourth.
- **No shadow-heavy design** — borders + soft shadows only. `shadow-xl` only on drag preview and modals.
- **No `outline-none` without replacement** — always `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
- **No mixing border-radius** — default to `rounded-lg` everywhere.
- **No custom modal/dropdown/toast implementations** when shadcn provides them.
- **No N+1 queries** — use Prisma `include`/`select` to eager-load.
- **No `any` type** — use `unknown` and narrow, or define proper types.
- **No silent error swallowing** — every catch must log or surface the error.

### Backend
- All routes under `/api` prefix
- Error format: `{ statusCode, message, error }`
- Auth required on every protected route via `@UseGuards(JwtAuthGuard)`
- Authorization rule: OWNER > EDITOR > VIEWER. Default deny.
- Use the helper `boardsService.hasAccess(userId, boardId, minRole?)` for permission checks
- Never return `passwordHash` in any response

### Frontend
- All primitives come from shadcn/ui
- Token stored in `localStorage` under `kanban_token`
- User stored in `localStorage` under `kanban_user`
- On 401 from any API call: clear token, redirect to `/login`
- Loading states: shadcn `<Skeleton>` matching the shape of what loads
- Empty states: per DESIGN.md template (centered icon + text + CTA)
- Error states: Sonner toast for transient; inline `<FormMessage>` for form errors

---

## 📝 Iteration Log Maintenance

**After every non-trivial iteration, append a permanent record to `/docs/iteration-log.md`.**

Skip this for trivial edits (typos, single-line fixes, file reads).

Entry format:
```markdown
## [YYYY-MM-DD HH:MM] — Iteration N: Title

**Spec:** [link to spec or "ad-hoc"]
**Phase:** [Day 1 | Day 2 | Day 3 | Day 4 | Bugfix | Polish]

### What was built
- ...

### Decisions
- ...

### Files touched
- ...

### Considered but rejected
- ...

### Next
- ...
```

This log lets you (and future agents) reconstruct what happened without scrolling through chat.

---

## 📋 Workflow Per Iteration

1. **Read** the spec + relevant context files
2. **State the plan** in 2-3 bullets ("I will: scaffold X, add Y, test Z")
3. **Execute** the work
4. **Verify** against acceptance criteria
5. **Append** to `/docs/iteration-log.md`
6. **Propose** a commit message if appropriate (one-line, no Co-Authored-By)
7. **Stop** and wait for the user

---

## 🔄 Spec Drift Protocol

If during implementation you discover:
- The spec is wrong → update the spec file first, then implement
- A new pattern is needed → update DESIGN.md and this file
- A decision contradicts existing rules → flag it explicitly to the user, don't silently override

Specs are living documents. Updating them is **encouraged**, not a sign of failure. But always announce the change.

---

## 🆘 When Stuck

If you can't make progress on a task:
1. **State the blocker clearly:** "I can't proceed because X. I see two paths: A or B."
2. **Ask the user** using `AskUserQuestion` with 2-4 concrete options
3. **Never silently pick** an option that contradicts the spec or this file

Pausing to ask is a feature, not a bug.

---

## 📞 Communication Tone

When talking to the user:
- Direct, not chatty
- "Done" not "I've successfully completed the implementation of..."
- Use lists and headers, not walls of text
- If something will take >5 minutes, say so upfront
- If you made a mistake, say "I made a mistake" not "an unexpected issue occurred"