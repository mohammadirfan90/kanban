'use client';

import { useState } from 'react';
import {
  Copy,
  Loader2,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ApiClientError } from '@/lib/api';

export interface ColumnMenuProps {
  columnId: string;
  columnTitle: string;
  /** True iff there is only one column left — delete would be rejected by backend. */
  isLastColumn: boolean;
  /** This column's current slot, and how many there are, for "Move list". */
  index: number;
  columnCount: number;
  pinned: boolean;
  onRename: () => void;
  onDelete: (columnId: string) => Promise<void>;
  onAddCard: () => void;
  onCopy: (columnId: string) => Promise<void>;
  /** Move this column to an absolute slot. */
  onMoveTo: (columnId: string, index: number) => Promise<void>;
  onTogglePin: (columnId: string) => void;
}

export function ColumnMenu({
  columnId,
  columnTitle,
  isLastColumn,
  index,
  columnCount,
  pinned,
  onRename,
  onDelete,
  onAddCard,
  onCopy,
  onMoveTo,
  onTogglePin,
}: ColumnMenuProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState(false);

  const handleDelete = async () => {
    if (isLastColumn) return;
    setBusy(true);
    try {
      await onDelete(columnId);
      toast.success(`Deleted "${columnTitle}"`);
      setConfirming(false);
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Could not delete column');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    setWorking(true);
    try {
      await onCopy(columnId);
      toast.success(`Copied "${columnTitle}"`);
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Could not copy the list');
    } finally {
      setWorking(false);
    }
  };

  const handleMove = async (to: number) => {
    if (to === index) return;
    setWorking(true);
    try {
      await onMoveTo(columnId, to);
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Could not move the list');
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${columnTitle}`}
            title="List actions"
          >
            {working ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>List actions</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={onAddCard}>
            <Plus />
            Add card
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRename}>
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleCopy()}>
            <Copy />
            Copy list
          </DropdownMenuItem>

          {/*
            Absolute slots rather than "move left / right".

            With more than a handful of columns, repeatedly nudging a list one
            place at a time is both tedious and easy to overshoot — and every
            nudge is its own round trip. Picking the destination is one request
            and one undoable step.
          */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={columnCount < 2}>
              <MoreHorizontal />
              Move list
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
              {Array.from({ length: columnCount }, (_, slot) => (
                <DropdownMenuItem
                  key={slot}
                  disabled={slot === index}
                  onClick={() => void handleMove(slot)}
                >
                  Position {slot + 1}
                  {slot === index && (
                    <span className="ml-auto text-xs text-muted-foreground">current</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/*
            Pinning is a per-viewer preference, not board data: it changes how
            YOU scroll, so pinning a list should not move it for a teammate.
            That is why it never reaches the API.
          */}
          <DropdownMenuItem onClick={() => onTogglePin(columnId)}>
            {pinned ? <PinOff /> : <Pin />}
            {pinned ? 'Unpin list' : 'Pin list'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={isLastColumn}
            onClick={() => !isLastColumn && setConfirming(true)}
            title={isLastColumn ? 'Cannot delete the last column' : undefined}
          >
            <Trash2 />
            Delete list
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={(open) => !open && setConfirming(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete column?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{columnTitle}</strong> and all its tasks will be permanently deleted. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
