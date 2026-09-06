'use client';

import { useState } from 'react';
import { Check, Loader2, Plus, Tag, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ApiClientError } from '@/lib/api';
import { createLabel } from '@/lib/labels';
import { LABEL_COLORS, TASK_PRIORITIES, type BoardLabel, type LabelColor, type TaskPriority } from '@/lib/types';
import { cn } from '@/lib/utils';
import { LABEL_SWATCHES, LabelChip, PriorityIndicator } from './task-meta';

// ── priority ────────────────────────────────────────────────────────────

/**
 * Priority as a segmented control rather than a dropdown.
 *
 * There are only four values plus "none", so a select would hide the whole
 * range behind a click for no benefit. "None" is a first-class option here
 * because clearing a priority has to be as easy as setting one.
 */
export function PriorityField({
  value,
  onChange,
  disabled,
}: {
  value: TaskPriority | null;
  onChange: (next: TaskPriority | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>Priority</Label>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={value === null ? 'secondary' : 'outline'}
          disabled={disabled}
          onClick={() => onChange(null)}
          aria-pressed={value === null}
        >
          None
        </Button>
        {TASK_PRIORITIES.map((priority) => (
          <Button
            key={priority}
            type="button"
            size="sm"
            variant={value === priority ? 'secondary' : 'outline'}
            disabled={disabled}
            onClick={() => onChange(priority)}
            aria-pressed={value === priority}
          >
            <PriorityIndicator priority={priority} showLabel />
          </Button>
        ))}
      </div>
    </div>
  );
}

// ── due date ────────────────────────────────────────────────────────────

/** ISO timestamp -> `yyyy-mm-dd` for a native date input, in local time. */
function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function DueDateField({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
}) {
  const inputValue = toDateInputValue(value);

  return (
    <div className="space-y-2">
      <Label htmlFor="task-due-date">Due date</Label>
      <div className="flex items-center gap-2">
        <Input
          id="task-due-date"
          type="date"
          value={inputValue}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value;
            if (!next) return onChange(null);
            // A bare `yyyy-mm-dd` parses as UTC midnight, which lands on the
            // previous day for anyone west of Greenwich. Constructing from the
            // parts keeps the date the user picked.
            const [y, m, d] = next.split('-').map(Number);
            onChange(new Date(y, m - 1, d, 12, 0, 0).toISOString());
          }}
        />
        {inputValue && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onChange(null)}
            disabled={disabled}
            aria-label="Clear due date"
            title="Clear due date"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── labels ──────────────────────────────────────────────────────────────

export function LabelField({
  boardId,
  boardLabels,
  selectedIds,
  onChange,
  onLabelCreated,
  disabled,
}: {
  boardId: string;
  boardLabels: BoardLabel[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  /** Lifts a newly created label so the board's list stays in sync. */
  onLabelCreated?: (label: BoardLabel) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState<LabelColor>('sky');
  const [creating, setCreating] = useState(false);

  const selected = boardLabels.filter((l) => selectedIds.includes(l.id));

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const submitNewLabel = async () => {
    const name = draftName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const label = await createLabel(boardId, { name, color: draftColor });
      onLabelCreated?.(label);
      onChange([...selectedIds, label.id]);
      setDraftName('');
    } catch (e) {
      // 409 means the name is taken on this board — worth saying plainly
      // rather than leaving the button looking broken.
      toast.error(e instanceof ApiClientError ? e.message : 'Could not create label');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Labels</Label>

      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((label) => (
          <button
            key={label.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(label.id)}
            className="rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
            aria-label={`Remove label ${label.name}`}
            title={`Remove ${label.name}`}
          >
            <LabelChip label={label} />
          </button>
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={disabled}>
              <Tag className="mr-1.5 h-3.5 w-3.5" />
              {selected.length > 0 ? 'Edit' : 'Add label'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="max-h-48 space-y-0.5 overflow-y-auto">
              {boardLabels.length === 0 && (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  No labels on this board yet.
                </p>
              )}
              {boardLabels.map((label) => {
                const isSelected = selectedIds.includes(label.id);
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => toggle(label.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                    aria-pressed={isSelected}
                  >
                    <span
                      className={cn('h-2.5 w-2.5 shrink-0 rounded-full', LABEL_SWATCHES[label.color])}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate">{label.name}</span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 space-y-2 border-t pt-2">
              <div className="flex flex-wrap gap-1">
                {LABEL_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setDraftColor(color)}
                    className={cn(
                      'h-5 w-5 rounded-full ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      LABEL_SWATCHES[color],
                      draftColor === color && 'ring-2 ring-foreground ring-offset-2',
                    )}
                    aria-label={`Use ${color}`}
                    aria-pressed={draftColor === color}
                    title={color}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void submitNewLabel();
                    }
                  }}
                  placeholder="New label"
                  maxLength={40}
                  disabled={creating}
                  className="h-9"
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => void submitNewLabel()}
                  disabled={creating || draftName.trim().length === 0}
                  aria-label="Create label"
                  title="Create label"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
