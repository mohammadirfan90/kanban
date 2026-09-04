'use client';

import { useState } from 'react';
import { Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ApiClientError } from '@/lib/api';

export interface ColumnMenuProps {
  columnId: string;
  columnTitle: string;
  /** True iff there is only one column left — delete would be rejected by backend. */
  isLastColumn: boolean;
  onRename: () => void;
  onDelete: (columnId: string) => Promise<void>;
}

export function ColumnMenu({
  columnId,
  columnTitle,
  isLastColumn,
  onRename,
  onDelete,
}: ColumnMenuProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (isLastColumn) return;
    setBusy(true);
    try {
      await onDelete(columnId);
      toast.success(`Deleted "${columnTitle}"`);
      setConfirming(false);
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Could not delete column';
      toast.error(msg);
    } finally {
      setBusy(false);
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
            title="Actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onRename}>
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={isLastColumn}
            onClick={() => !isLastColumn && setConfirming(true)}
            title={isLastColumn ? 'Cannot delete the last column' : undefined}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirming}
        onOpenChange={(open) => !open && setConfirming(false)}
      >
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
