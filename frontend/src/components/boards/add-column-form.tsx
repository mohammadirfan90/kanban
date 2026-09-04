'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiClientError } from '@/lib/api';

const COLUMN_WIDTH = 'w-80'; // matches KanbanColumn

export interface AddColumnFormProps {
  onCreate: (title: string) => Promise<void>;
}

export function AddColumnForm({ onCreate }: AddColumnFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = async () => {
    const trimmed = title.trim();
    if (trimmed.length === 0) return;
    setBusy(true);
    try {
      await onCreate(trimmed);
      setTitle('');
      // Close after creating — unlike tasks, columns are heavyweight enough to
      // require deliberate thought about the next one.
      setOpen(false);
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Could not create column';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div
        className={`flex ${COLUMN_WIDTH} shrink-0 flex-col gap-1`}
        data-testid="add-column-tile"
      >
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => setOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add column
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`flex ${COLUMN_WIDTH} shrink-0 flex-col gap-2 rounded-lg bg-muted/30 p-3`}
    >
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
          if (e.key === 'Escape') {
            setTitle('');
            setOpen(false);
          }
        }}
        placeholder="Column title"
        maxLength={100}
        disabled={busy}
        className="h-8 text-sm font-semibold"
      />
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          onClick={() => void submit()}
          disabled={busy || title.trim().length === 0}
        >
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
          Create
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            setTitle('');
            setOpen(false);
          }}
          disabled={busy}
          aria-label="Cancel"
          title="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
