# Spec 10 — Drag-and-Drop Kanban Board UI (Premium)

## Goal
Build a **premium, polished Kanban board view** with drag-and-drop task movement, full CRUD UI for columns and tasks, role-based visibility, and keyboard accessibility. The board view is the centerpiece of the product — it must feel like a paid SaaS, not a tutorial demo.

## Context
- Frontend: Next.js 14 with shadcn/ui, Sonner toasts (Specs 03, 04, 09 complete)
- **All UI must conform to `/DESIGN.md`** — every visual decision references it. Update DESIGN.md if a new pattern emerges; do not let custom implementations drift away from the design system.
- Backend task movement endpoint from Spec 08 is ready
- Use `@dnd-kit/core` + `@dnd-kit/sortable` (NOT `react-dnd` or `react-beautiful-dnd`)
- Icons: Lucide
- Toasts: Sonner
- Forms: react-hook-form + zod via shadcn `<Form>`

## Inputs
- Backend endpoints available for boards, columns, tasks, and task move
- Auth context available
- API client (`lib/api.ts`) with token injection

## Outputs

### Pages
- `frontend/src/app/boards/page.tsx` — list of boards (with create button)
- `frontend/src/app/boards/[id]/page.tsx` — single board view with drag-and-drop

### Components (all shadcn-based)
- `frontend/src/components/board/board-list.tsx` — list boards, click to open
- `frontend/src/components/board/create-board-dialog.tsx` — shadcn `<Dialog>` + `<Form>`
- `frontend/src/components/board/kanban-board.tsx` — main `<DndContext>` wrapper
- `frontend/src/components/board/kanban-column.tsx` — single column with sortable tasks
- `frontend/src/components/board/task-card.tsx` — single task (sortable item)
- `frontend/src/components/board/task-detail-dialog.tsx` — view/edit/delete a task
- `frontend/src/components/board/add-column-form.tsx` — inline form to add new column
- `frontend/src/components/board/create-task-dialog.tsx` — shadcn `<Dialog>` + `<Form>`
- `frontend/src/components/board/column-menu.tsx` — shadcn `<DropdownMenu>` for rename/delete
- `frontend/src/components/board/board-header.tsx` — title, share button, member avatars, settings
- `frontend/src/components/board/empty-column.tsx` — shadcn empty state (per DESIGN.md)
- `frontend/src/components/board/board-skeleton.tsx` — shadcn `<Skeleton>` for loading

### Library code
- `frontend/src/lib/columns.ts` — `createColumn`, `updateColumn`, `deleteColumn`, `reorderColumns`
- `frontend/src/lib/tasks.ts` — `createTask`, `updateTask`, `deleteTask`, `moveTask`
- `frontend/src/hooks/use-board-data.ts` — fetches board + manages optimistic updates

## Constraints
- **Library stack (add to package.json):**
  - `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
  - `react-hook-form` + `zod` + `@hookform/resolvers`
  - `sonner` (toasts — already added with shadcn)
  - `lucide-react` (icons — already added)
  - `next-themes` (dark mode — already added)
- **Component library:** **shadcn only**. Use `<Dialog>`, `<Form>`, `<Input>`, `<Textarea>`, `<Select>`, `<Button>`, `<DropdownMenu>`, `<Avatar>`, `<Badge>`, `<Skeleton>`, `<AlertDialog>`, `<Tooltip>`, `<Card>`, `<ScrollArea>`. No custom modal/dropdown implementations.
- **DnD behavior:**
  - Tasks within a column: reorder via `SortableContext` with `verticalListSortingStrategy`
  - Tasks across columns: drop into a different column's `SortableContext`
  - Use `DndContext` with `closestCorners` collision detection (NOT `closestCenter` for multi-column)
  - `onDragEnd`: compute new columnId and newIndex, call `moveTask` API
  - **Sensors:** `PointerSensor` + `KeyboardSensor` (for accessibility — Space picks up, arrows move, Space drops, Esc cancels)
- **Optimistic updates:**
  - On drop: immediately update local state with new order
  - Call `PATCH /api/tasks/:id/move` with `{ targetColumnId, newIndex }`
  - On error: revert local state and `toast.error("Failed to move task — try again")`
  - On success: silent (or subtle `toast.success` if non-obvious move)
- **Read-only mode for VIEWER:**
  - Disable all drag handles if `board.role === 'VIEWER'`
  - Hide Add buttons if VIEWER
  - Hide Edit/Delete menus if VIEWER
- **Premium visual details (per DESIGN.md):**
  - **TaskCard:**
    - shadcn `<Card>` with `hover:shadow-sm transition-shadow` (only on hover, not always — see DESIGN.md elevation rules)
    - Layout: `<CardHeader className="p-4">` with title (line-clamp-2), `<CardContent>` with truncated description (line-clamp-1) + assignee avatar
    - While dragging: `shadow-lg ring-2 ring-primary/20 rotate-1 opacity-90` (DESIGN.md drag state)
  - **KanbanColumn:**
    - Fixed width `w-80` (320px), `bg-muted/30` subtle background, `rounded-lg`
    - Header: title (`text-sm font-semibold`), task count badge (`bg-secondary text-secondary-foreground`), overflow `<DropdownMenu>` for actions
    - Drop target highlight: `ring-2 ring-primary/30 bg-accent/40` when a draggable is over
    - Empty state: `<empty-column>` component with `<Inbox>` icon + muted text + "+ Add task" button (EDITOR only)
    - "+ Add task" button at bottom: ghost variant, full width, `<Plus>` icon
  - **AddColumnForm:** inline `<Input>` + submit `<Button>`, ghost-styled, appears at right of last column as a "+ Add column" tile (also `w-80`)
  - **BoardHeader:** title, share button (with `<UserPlus>` icon), member avatar stack (overlapping `<Avatar>` with `ring-2 ring-background`), role badge for current user
  - **TaskDetailDialog:** read mode + edit mode toggle; title, description textarea, assignee `<Select>`, delete button (destructive `<AlertDialog>` confirm); "Save" button shows `<Loader2>` while pending
- **Colors and tokens (per DESIGN.md):**
  - All colors via Tailwind tokens — no hex
  - Member role badges: `bg-kanban-owner/editor/viewer` (defined in `tailwind.config.ts`)
  - Drop zone highlight: `ring-primary bg-accent` (tokens, not hex)
- **Empty states (per DESIGN.md template):**
  - Each empty column shows `<Inbox>` icon + "No tasks" + "+ Add task" CTA (hidden for VIEWER)
  - Empty board (no columns) shows centered state with "Create your first column" CTA
- **Loading states:** `<BoardSkeleton>` renders 3 column-shaped skeletons while fetching
- **Error states:** full-page shadcn `<Alert variant="destructive">` with retry button
- **Keyboard accessibility:** all DnD interactions must be keyboard-accessible via `KeyboardSensor`; focus rings always visible (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`)
- **Visual feedback during drag:** card becomes semi-transparent, drop zones highlighted with subtle ring + accent bg
- **Animation:** dnd-kit's built-in CSS transforms for smooth drop; `transition-all duration-200 ease-out` on hover states
- **Responsive (per DESIGN.md):**
  - `lg+`: full board layout, columns side-by-side, no horizontal scroll
  - `<lg`: horizontal scroll with `snap-x snap-mandatory` on the board container
- **Iconography (Lucide only):**
  - `Plus` for add buttons
  - `MoreHorizontal` for column menus
  - `Trash2` for delete
  - `Pencil` for rename
  - `UserPlus` for share
  - `Inbox` for empty states
  - `GripVertical` for drag handle (optional, can be hover-only)
  - **No emoji** as functional icons

## Acceptance Criteria

### Functional
- [ ] `/boards` lists all boards user has access to (skeleton while loading)
- [ ] "+ Create Board" button opens shadcn `<Dialog>`, creates board, navigates to new board
- [ ] `/boards/:id` loads board with columns and tasks in correct order
- [ ] Tasks are draggable within their column
- [ ] Tasks can be dragged across columns
- [ ] On drop, the API call is made and local state updates optimistically
- [ ] If API fails, state reverts and `toast.error` shows
- [ ] After successful move, refreshing the page shows the new order (persisted)
- [ ] VIEWER role: drag handles disabled, add/edit/delete buttons hidden
- [ ] EDITOR role: can drag, add, edit, delete — but not share
- [ ] OWNER role: full access including share
- [ ] "+ Add Column" inline form creates new column at end
- [ ] Column menu has Rename + Delete options
- [ ] Cannot delete last remaining column (button disabled or shows error)
- [ ] "+ Add Task" button in each column opens shadcn `<Dialog>` with `<Form>`
- [ ] Task card click opens detail `<Dialog>` with edit/delete
- [ ] All modals close on Escape and outside click
- [ ] All loading states use shadcn `<Skeleton>`
- [ ] Keyboard-only user can drag tasks via `KeyboardSensor` (Tab + Space + Arrow + Space)
- [ ] On window resize, board remains usable (horizontal scroll for many columns on `<lg`)

### DESIGN.md compliance
- [ ] **All components use shadcn/ui primitives** (no Material/Chakra/MUI/Bootstrap)
- [ ] All colors come from CSS variable tokens — no hardcoded hex anywhere in `src/`
- [ ] Inter font renders correctly via `next/font`
- [ ] Dark mode toggle works seamlessly on this view (`<html class="dark">`)
- [ ] Role badges use `bg-kanban-owner/editor/viewer` tokens
- [ ] Drag overlay uses `shadow-lg ring-2 ring-primary/20 rotate-1`
- [ ] Drop target uses `ring-2 ring-primary/30 bg-accent/40`
- [ ] No emoji used as functional icons (Lucide only)
- [ ] No gradients (except subtle in dark mode hero if needed)
- [ ] No `shadow-xl` on resting cards — only on drag overlay and modals
- [ ] No bounce/parallax animations — only subtle dnd-kit transitions
- [ ] Empty columns show centered `<Inbox>` icon + muted text + CTA (per DESIGN.md template)
- [ ] Border-radius consistent (`rounded-lg` default, no mixing)
- [ ] Focus rings always visible when tabbing
- [ ] Sonner toasts appear in top-right with correct styling
- [ ] **"Premium feel" gut check:** open the page, look at it for 5 seconds. Does it feel like a paid product? If not, fix what's off before merging.

## Out of Scope
- Real-time multi-user sync (WebSockets — deferred to v2)
- Optimistic conflict resolution across users (server is source of truth)
- Column drag-reorder UI (column reorder via separate menu action or v2)
- Task comments / activity log UI
- Search / filter on board
- Mobile-first layout (desktop-optimized; must not break on mobile)
- Custom themes beyond light/dark