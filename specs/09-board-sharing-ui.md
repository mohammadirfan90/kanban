# Spec 09 — Board Sharing UI

## Goal
Build the **premium shadcn-based** UI for board owners to share their board with other users and manage access (revoke, change role). Also surface the member list and role badges on the board view.

## Context
- Frontend: Next.js 14 with shadcn/ui, Sonner toasts (Specs 03, 04 complete)
- **All UI must conform to `/DESIGN.md`** — shadcn primitives, role color tokens, no custom components when shadcn has them
- Backend share endpoints exist from Spec 05
- Only OWNER can share/revoke; viewers and editors see the member list but cannot modify it
- **Role colors:** OWNER = indigo (`bg-kanban-owner`), EDITOR = emerald (`bg-kanban-editor`), VIEWER = slate (`bg-kanban-viewer`) — defined in `tailwind.config.ts` per DESIGN.md

## Inputs
- Backend endpoints available:
  - `POST /api/boards/:id/share` — body: `{ userId, role: 'EDITOR' | 'VIEWER' }`
  - `DELETE /api/boards/:id/share/:userId`
- Board response includes `members: [{ userId, email, name, role }]` and `role` (caller's role)

## Outputs
- `frontend/src/app/boards/[id]/page.tsx` — modify to include Share button + member panel
- `frontend/src/components/board/share-board-dialog.tsx` — shadcn `<Dialog>` with `<Form>` for sharing
- `frontend/src/components/board/member-list.tsx` — list of members with role badges + remove button
- `frontend/src/components/board/role-badge.tsx` — reusable badge for OWNER/EDITOR/VIEWER using `bg-kanban-*` tokens
- `frontend/src/components/board/user-search-input.tsx` — shadcn `<Input>` with debounced email validation
- `frontend/src/lib/boards.ts` — `listBoards()`, `getBoard(id)`, `createBoard()`, `shareBoard()`, `revokeAccess()`
- `frontend/src/hooks/use-board.ts` — fetches board by id, handles loading/error, exposes refresh

## Constraints
- **All components use shadcn primitives** — `<Dialog>`, `<Form>`, `<Input>`, `<Button>`, `<Select>`, `<Badge>`, `<Avatar>`, `<AlertDialog>` (for remove confirm), `<DropdownMenu>` (for per-member actions)
- **RoleBadge** uses the `kanban-owner/editor/viewer` color tokens from `tailwind.config.ts` (see DESIGN.md)
  - OWNER: `<Badge className="bg-kanban-owner text-kanban-owner-foreground">`
  - EDITOR: `<Badge className="bg-kanban-editor text-kanban-editor-foreground">`
  - VIEWER: `<Badge className="bg-kanban-viewer text-kanban-viewer-foreground">`
- **share-board-dialog:**
  - Triggered by "Share" button (visible only if `board.role === 'OWNER'`) — use shadcn `<Button variant="outline">` with `<UserPlus>` icon
  - Form: shadcn `<Form>` (react-hook-form + zod) with email `<Input>` and role `<Select>` (EDITOR/VIEWER options only)
  - On submit: call `POST /api/boards/:id/share`, show `toast.success("Invitation sent to {email}")`, refresh member list, reset form
  - On error: `toast.error(...)` with the server message; inline `<FormMessage>` for validation errors
- **user-search-input:**
  - Debounced email validation (300ms)
  - For v1: simple shadcn `<Input type="email">` where user types full email (no autocomplete — backend has no user search endpoint)
  - zod validation: `.email()` format, required
- **member-list:**
  - Render as shadcn `<Card>` containing a `divide-y divide-border` list
  - Each row: shadcn `<Avatar>` (initials fallback) + name + email + `<RoleBadge>` + (if OWNER viewing AND not self) `<DropdownMenu>` with "Remove" item
  - OWNER row: no remove action (cannot remove self)
  - Empty state: small muted text "Only you have access"
- **Remove confirmation:** shadcn `<AlertDialog>` with destructive button text matching the action ("Remove")
- **Loading states:** shadcn `<Skeleton>` for member rows while loading
- **Error feedback:** Sonner `toast.error(...)` for all failures
- All forms validate client-side via zod before API call
- **All colors via CSS variable tokens** — no hardcoded hex
- **No emoji as icons** — use Lucide (`UserPlus`, `Trash2`, `MoreHorizontal`, `X`)

## Acceptance Criteria
- [ ] Share button only visible when current user is OWNER
- [ ] Share button not visible to EDITOR or VIEWER
- [ ] Clicking Share opens shadcn `<Dialog>` with email `<Input>` + role `<Select>`
- [ ] Submitting share form with valid email + role adds user to board + shows `toast.success`
- [ ] Submitting share form with invalid email shows inline `<FormMessage>` error
- [ ] Submitting share form with already-shared user shows `toast.error` "Already a member"
- [ ] Submitting share form with non-existent email shows `toast.error` "User not found"
- [ ] After successful share, member list updates without full page reload
- [ ] MemberList shows all members with correct role-colored badges (indigo/emerald/slate)
- [ ] OWNER cannot remove themselves (no remove action in dropdown)
- [ ] OWNER can remove EDITOR/VIEWER members via dropdown → AlertDialog confirm
- [ ] Removing a member shows confirmation dialog before deleting
- [ ] After remove, member disappears from list and can no longer access board
- [ ] All API calls handle loading state (submit button disabled, spinner shown)
- [ ] All API errors show toast OR inline message
- [ ] Modal closes on Escape and on outside click
- [ ] No console errors during normal flow
- [ ] **DESIGN.md compliance:**
  - [ ] Inter font renders
  - [ ] All colors from tokens (no hex)
  - [ ] No emoji used as icons
  - [ ] Dark mode toggle works on this view
  - [ ] Role badges use `bg-kanban-*` classes

## Out of Scope
- Change role of existing member (only add/remove in v1)
- Bulk invite by email list
- Email notifications when shared
- Public shareable links
- Pending invitations (must accept before access)