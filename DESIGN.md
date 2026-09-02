# DESIGN.md — Visual & Interaction Design Contract

This document is the **source of truth for UI**. Every spec that touches the frontend MUST conform to this. When design decisions change, update this file — do not let drift accumulate.

---

## Design Philosophy

**Premium. Calm. Confident.**

The interface should feel like a paid product, not a tutorial. Generous whitespace, restrained color, deliberate typography. Avoid the trap of looking like a Bootstrap demo.

Three rules:
1. **Quiet chrome, loud content.** UI elements recede; the user's data stands forward.
2. **Motion has meaning.** Transitions communicate state, never decorate.
3. **Hierarchy through type and space, not color.** Use the accent color sparingly.

---

## Component Library

**Use [shadcn/ui](https://ui.shadcn.com/) exclusively.** Do not pull in Material, Chakra, MUI, Bootstrap, or other libraries. shadcn components are copied into the repo (`src/components/ui/`) and owned — modify freely.

### Why shadcn
- Built on Radix primitives → accessibility is correct by default
- Tailwind-native → matches our stack
- Copy-paste ownership → no version lock-in, fully customizable
- Used by Linear, Vercel, and other premium products as a base

### Required shadcn components (install these during scaffold)
```bash
npx shadcn@latest init
npx shadcn@latest add button input label card dialog dropdown-menu \
  select textarea sonner tooltip avatar badge separator \
  skeleton alert form command popover scroll-area tabs \
  alert-dialog
```
(Generate as needed during spec implementation.)

### Do not build custom when shadcn has it
If a shadcn component exists, use it. Custom implementations are only for **app-specific composites** (e.g., `KanbanColumn`, `TaskCard`).

---

## Color System

**Two modes: light (primary), dark (secondary support).** Token-driven via CSS variables — never hardcode hex in components.

### Tokens (configure in `tailwind.config.ts` + `globals.css` via `:root` and `.dark`)

Light theme (default):
- `background`: `0 0% 100%` (pure white)
- `foreground`: `222 47% 11%` (soft near-black, not pure)
- `border`: `214 32% 91%`
- `input`: `214 32% 91%`
- `ring`: `222 47% 11%`
- `primary`: `222 47% 11%` (ink — premium feel, **not** default Tailwind blue)
- `primary-foreground`: `210 40% 98%`
- `secondary`: `210 40% 96%`
- `muted`: `210 40% 96%`
- `muted-foreground`: `215 16% 47%`
- `accent`: `210 40% 96%`
- `accent-foreground`: `222 47% 11%`
- `destructive`: `0 84% 60%`
- `destructive-foreground`: `210 40% 98%`

Dark theme (`.dark`):
- `background`: `222 47% 4%`
- `foreground`: `210 40% 98%`
- `border`: `217 33% 17%`
- `primary`: `210 40% 98%`
- `primary-foreground`: `222 47% 11%`
- `muted`: `217 33% 17%`
- `accent`: `217 33% 17%`

### Domain-specific role colors (for board membership)
```ts
'kanban-owner':  { DEFAULT: '#6366f1', foreground: '#ffffff' },  // indigo
'kanban-editor':  { DEFAULT: '#10b981', foreground: '#ffffff' },  // emerald
'kanban-viewer':  { DEFAULT: '#94a3b8', foreground: '#ffffff' },  // slate
```

### Usage rules
- **Primary button = filled ink** (high contrast, no brand blue by default)
- **Secondary = outline** with `border border-input bg-background hover:bg-accent hover:text-accent-foreground`
- **Destructive = `bg-destructive text-destructive-foreground`** — only for delete confirmations
- **Accent color appears in at most 1-2 places per screen** — typically the active nav item or focused state
- **Status colors:**
  - Success: emerald (`#10b981`) — use `text-emerald-600 dark:text-emerald-400`
  - Warning: amber (`#f59e0b`)
  - Error: red (`#ef4444`) — use `text-destructive`
  - Info: sky (`#0ea5e9`)

---

## Typography

**Font: Inter** (variable, self-hosted via `next/font/google`). Crisp, neutral, premium. Do not use system fonts as a fallback for production builds.

### Scale
| Token | Size | Line-height | Weight | Use |
|-------|------|-------------|--------|-----|
| `text-xs` | 12px | 16px | 400 | Helper text, badges |
| `text-sm` | 14px | 20px | 400 | Body, table cells |
| `text-base` | 16px | 24px | 400 | Default body |
| `text-lg` | 18px | 28px | 500 | Card titles |
| `text-xl` | 20px | 28px | 600 | Section headers |
| `text-2xl` | 24px | 32px | 600 | Page headers |
| `text-3xl` | 30px | 36px | 700 | Marketing/landing hero only |

### Rules
- Headings use `font-semibold` (600), never `font-bold` (700) except for hero
- Body text uses default weight (400)
- **Numerics** (task counts, positions): use `tabular-nums` for alignment
- **No uppercase text** outside of small labels in tabs/badges
- Letter-spacing: only on `tracking-tight` for headings, `tracking-wider` for UPPERCASE labels

---

## Spacing & Layout

### Base unit
Tailwind's default 4px scale. Use semantic tokens, not arbitrary values.

### Spacing rhythm
| Context | Value |
|---------|-------|
| Inline icon + text gap | `gap-2` (8px) |
| Form field vertical rhythm | `space-y-4` (16px between fields) |
| Card padding | `p-6` (24px) |
| Section spacing | `space-y-8` (32px) |
| Page padding | `px-8 py-12` on desktop, `px-4 py-6` on mobile |
| Column gap (board view) | `gap-4` (16px between columns) |

### Max widths
- Auth pages: `max-w-md` (centered card)
- Dashboard / lists: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- Modals: shadcn defaults (`sm:max-w-[425px]` forms, `sm:max-w-lg` content)

### Grid
- Board view: horizontal flex with `gap-4`, `overflow-x-auto`, columns are fixed-width `w-80` (320px)
- Lists (boards list, members list): vertical stack with `divide-y divide-border`

---

## Elevation & Borders

### Strategy: borders over shadows
Premium products lean on **subtle borders + soft shadows**, not heavy drop shadows. The Kanban UI has lots of cards — heavy shadows would feel busy.

### Use
- `shadow-sm` for raised cards on hover (task cards, board cards)
- `shadow-md` for modals and popovers
- `shadow-lg` sparingly — only for drag preview and toasts
- `border border-border` on all input fields, cards, dividers
- `rounded-lg` is the default radius (matches shadcn defaults)

### Drag state
- Task being dragged: `shadow-lg ring-2 ring-primary/20 rotate-1 opacity-90`
- Drop target column: `ring-2 ring-primary/30 bg-accent/40` (subtle highlight)

---

## Motion

**Library:** Use Tailwind's built-in transitions + `framer-motion` only when needed for orchestrated animations. dnd-kit handles drag-and-drop animations itself.

### Principles
- All transitions: `transition-all duration-200 ease-out` (or `duration-150`)
- Hover states: 150ms
- Modal open/close: 200ms with fade + scale
- Page transitions: none (instant — feels snappier)
- Toast enter: slide from top-right + fade

### Don't
- No bounce
- No parallax
- No auto-playing animations
- No loading spinners that spin for >2s without text ("Loading..." beside it)

---

## Iconography

**Library: [Lucide](https://lucide.dev/)** — bundled with shadcn. Stroke-based, geometric, matches the aesthetic.

Rules:
- Default size: `h-4 w-4` (16px) inline with text, `h-5 w-5` (20px) standalone
- Always pair icons with text on primary actions (`<Plus className="mr-2 h-4 w-4" /> New Board`)
- Icon-only buttons MUST have `aria-label` and `title`
- **Never use emoji as functional icons** (decorative emoji in empty states is OK)

---

## Empty, Loading, Error States

Every list/page MUST handle all three. No silent failures.

### Empty states
```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <Inbox className="h-12 w-12 text-muted-foreground/40" />
  <h3 className="mt-4 text-lg font-semibold">No boards yet</h3>
  <p className="mt-2 text-sm text-muted-foreground max-w-sm">
    Create your first board to start organizing your work.
  </p>
  <Button className="mt-6"><Plus className="mr-2 h-4 w-4" />Create Board</Button>
</div>
```

### Loading states
- Use shadcn `Skeleton` for content placeholders
- Match the shape of what will load
- For full-page loads: `Skeleton` matching the page layout

### Error states
- Toast (Sonner) for transient errors (network, validation)
- Inline error under form fields (`<p className="text-sm text-destructive">`)
- Full-page error for fatal errors with a retry button

---

## Forms

- Labels above inputs (shadcn `<Label>`), not placeholder-as-label
- Show validation errors below field, in `text-destructive text-sm`
- Disable submit button while pending
- Show spinner inside button: `<Loader2 className="mr-2 h-4 w-4 animate-spin" />`
- Required field indicator: asterisk after label (`Name *`)
- All inputs: `h-10` (40px) — shadcn default is correct
- Use shadcn `<Form>` (react-hook-form integration) for forms with >3 inputs

---

## Modals & Dialogs

**Use shadcn `Dialog`** for content, `AlertDialog` ONLY for destructive confirms.

- Title: `text-lg font-semibold`
- Description: `text-sm text-muted-foreground` — visible, not just for screen readers
- Footer: right-aligned, `Cancel` (outline) + `Confirm` (primary or destructive)
- Close on Escape, on outside click, on Cancel
- Destructive confirms: `AlertDialog` with explicit "Delete" button text matching the action

---

## Toasts

**Library: [Sonner](https://sonner.emilkowal.ski/)** — installed via shadcn `npx shadcn@latest add sonner`.

```tsx
toast.success("Board created");
toast.error("Failed to share board");
toast.promise(moveTask(), {
  loading: 'Moving task...',
  success: 'Task moved',
  error: 'Failed to move task',
});
```

Position: top-right. Max 3 visible at once.

---

## Accessibility

- All interactive elements keyboard-reachable
- Focus rings: never `outline-none` without replacement (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`)
- Modals: trap focus, return focus to trigger on close
- Color contrast: WCAG AA minimum (shadcn defaults comply)
- Drag-and-drop: keyboard alternative via dnd-kit sensors (Space to pick up, Arrow keys to move, Space to drop, Esc to cancel)

---

## Responsive Breakpoints

| Token | Min-width |
|-------|-----------|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `2xl` | 1536px |

### Behavior
- **Auth pages:** centered card on all sizes
- **Board view:** horizontal scroll below `lg`, full layout at `lg+`
- **Lists:** single column on mobile, table/cards at `md+`
- **Modals:** full-screen sheet on mobile, centered dialog at `sm+`

---

## Anti-Patterns (Do Not Ship)

❌ Tailwind's default blue (`bg-blue-500`) — use configured primary
❌ `bg-gradient-to-r from-purple-500 to-pink-500` — never
❌ Drop shadows on every card (`shadow-xl` everywhere)
❌ All-caps section headers with `tracking-widest`
❌ Emoji as icons (🎉 ✅ ⚡) — use Lucide
❌ Spinners without text
❌ Buttons with no feedback (no hover/active state)
❌ Mixing border-radius: `rounded-md` AND `rounded-lg` AND `rounded-xl` in same view — commit to `rounded-lg` default
❌ Custom dropdown/modal implementations when shadcn has one
❌ Hardcoded colors (`text-[#ff0000]`) — always use tokens
❌ Stock photos / illustrations in empty states — use Lucide icons

---

## Verification Checklist (before any UI merge)

- [ ] Uses shadcn components (no Material/Chakra/MUI/Bootstrap)
- [ ] Colors come from theme tokens (no hardcoded hex outside `tailwind.config.ts`)
- [ ] Inter font loads via `next/font` and applies
- [ ] All states handled: empty, loading, error, success
- [ ] All interactive elements keyboard-accessible
- [ ] Toasts (Sonner) for transient feedback
- [ ] Forms show validation inline
- [ ] Drag-and-drop has keyboard alternative
- [ ] Mobile layout doesn't break (horizontal scroll OK for board view)
- [ ] No console errors / no hydration warnings
- [ ] No emoji as functional icons
- [ ] No gradients (except subtle ones in dark mode hero if needed)
- [ ] No bounce/parallax animations
- [ ] Border-radius consistent (default `rounded-lg`)
- [ ] Dark mode works (test by toggling `.dark` on `<html>`)