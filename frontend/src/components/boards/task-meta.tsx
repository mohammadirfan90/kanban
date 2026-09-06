import { AlertTriangle, CalendarDays, ChevronsDown, ChevronUp, Equal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskLabel, TaskPriority } from '@/lib/types';

/**
 * Label colours as complete class strings.
 *
 * They have to be literals: Tailwind scans source text, so a constructed name
 * like `bg-${color}-100` is never emitted. Values come from Tailwind's own
 * palette rather than raw hex, which keeps DESIGN.md's "no hardcoded colors"
 * rule intact and gives each token a dark-mode variant.
 *
 * The treatment is deliberately quiet — tinted background, readable text, thin
 * ring. A board is mostly labels once it fills up, and saturated pills turn it
 * into confetti.
 */
const LABEL_STYLES: Record<string, string> = {
  slate:
    'bg-slate-100 text-slate-700 ring-slate-300/60 dark:bg-slate-400/15 dark:text-slate-300 dark:ring-slate-400/25',
  rose: 'bg-rose-100 text-rose-700 ring-rose-300/60 dark:bg-rose-400/15 dark:text-rose-300 dark:ring-rose-400/25',
  amber:
    'bg-amber-100 text-amber-800 ring-amber-300/60 dark:bg-amber-400/15 dark:text-amber-300 dark:ring-amber-400/25',
  emerald:
    'bg-emerald-100 text-emerald-700 ring-emerald-300/60 dark:bg-emerald-400/15 dark:text-emerald-300 dark:ring-emerald-400/25',
  sky: 'bg-sky-100 text-sky-700 ring-sky-300/60 dark:bg-sky-400/15 dark:text-sky-300 dark:ring-sky-400/25',
  indigo:
    'bg-indigo-100 text-indigo-700 ring-indigo-300/60 dark:bg-indigo-400/15 dark:text-indigo-300 dark:ring-indigo-400/25',
  violet:
    'bg-violet-100 text-violet-700 ring-violet-300/60 dark:bg-violet-400/15 dark:text-violet-300 dark:ring-violet-400/25',
  pink: 'bg-pink-100 text-pink-700 ring-pink-300/60 dark:bg-pink-400/15 dark:text-pink-300 dark:ring-pink-400/25',
};

/** Solid swatches, for the colour picker where the colour *is* the content. */
export const LABEL_SWATCHES: Record<string, string> = {
  slate: 'bg-slate-400',
  rose: 'bg-rose-400',
  amber: 'bg-amber-400',
  emerald: 'bg-emerald-400',
  sky: 'bg-sky-400',
  indigo: 'bg-indigo-400',
  violet: 'bg-violet-400',
  pink: 'bg-pink-400',
};

export function LabelChip({
  label,
  className,
}: {
  label: TaskLabel;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        LABEL_STYLES[label.color] ?? LABEL_STYLES.slate,
        className,
      )}
      title={label.name}
    >
      <span className="truncate">{label.name}</span>
    </span>
  );
}

// ── priority ────────────────────────────────────────────────────────────

const PRIORITY_META: Record<
  TaskPriority,
  { label: string; icon: typeof ChevronUp; className: string }
> = {
  LOW: { label: 'Low', icon: ChevronsDown, className: 'text-muted-foreground' },
  MEDIUM: { label: 'Medium', icon: Equal, className: 'text-sky-600 dark:text-sky-400' },
  HIGH: { label: 'High', icon: ChevronUp, className: 'text-amber-600 dark:text-amber-400' },
  URGENT: { label: 'Urgent', icon: AlertTriangle, className: 'text-destructive' },
};

export const priorityLabel = (priority: TaskPriority): string => PRIORITY_META[priority].label;

/**
 * Priority as an icon plus optional text.
 *
 * An icon, not just a coloured dot: colour alone fails for the ~8% of men with
 * a colour-vision deficiency, and "urgent" is exactly the signal you cannot
 * afford them to miss. The shape carries the meaning; the colour reinforces it.
 */
export function PriorityIndicator({
  priority,
  showLabel = false,
  className,
}: {
  priority: TaskPriority;
  showLabel?: boolean;
  className?: string;
}) {
  const meta = PRIORITY_META[priority];
  const Icon = meta.icon;
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-xs font-medium', meta.className, className)}
      title={`Priority: ${meta.label}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {showLabel ? meta.label : <span className="sr-only">Priority: {meta.label}</span>}
    </span>
  );
}

// ── due date ────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** Whole days from today to `date`, ignoring time of day. */
function daysUntil(date: Date): number {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDue = new Date(date);
  startOfDue.setHours(0, 0, 0, 0);
  return Math.round((startOfDue.getTime() - startOfToday.getTime()) / DAY_MS);
}

const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const shortDateWithYear = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/**
 * "Overdue", "Today", "Tomorrow", "Mar 3" — whichever is most useful.
 *
 * Relative wording only inside the window where it beats a date: past three
 * days out, "in 9 days" is harder to act on than "Mar 3". Dates in another
 * year always show the year, so a stale task can't read as imminent.
 */
export function formatDueDate(iso: string): { text: string; days: number } {
  const date = new Date(iso);
  const days = daysUntil(date);

  if (days < 0) return { text: days === -1 ? 'Yesterday' : `${Math.abs(days)}d overdue`, days };
  if (days === 0) return { text: 'Today', days };
  if (days === 1) return { text: 'Tomorrow', days };

  const sameYear = date.getFullYear() === new Date().getFullYear();
  return { text: (sameYear ? shortDate : shortDateWithYear).format(date), days };
}

export function DueDate({ dueDate, className }: { dueDate: string; className?: string }) {
  const { text, days } = formatDueDate(dueDate);

  // Overdue is an error state; due today or tomorrow is a warning. Anything
  // further out is just information and stays quiet.
  const tone =
    days < 0
      ? 'text-destructive'
      : days <= 1
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground';

  return (
    <span
      className={cn('inline-flex items-center gap-1 text-xs tabular-nums', tone, className)}
      title={new Date(dueDate).toLocaleString()}
    >
      <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {text}
      {days < 0 && <span className="sr-only">(overdue)</span>}
    </span>
  );
}
