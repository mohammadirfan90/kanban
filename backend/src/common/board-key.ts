/**
 * Derives the short prefix behind a board's task keys (`PR-14`).
 *
 * Mirrors the SQL in migration 20260906010000_task_depth, which backfills the
 * same shape for pre-existing boards — keep the two in step.
 *
 * Rules:
 *   - strip anything that isn't a letter or digit, treating it as a separator
 *   - several words  -> their initials, capped at 4  ("Product Roadmap" -> PR)
 *   - a single word  -> its first 4 characters       ("Phronesis" -> PHRO)
 *   - nothing usable -> "TASK"                       ("### ###" -> TASK)
 *
 * Not globally unique, and deliberately so: a key is only ever rendered beside
 * the board it belongs to, and forcing uniqueness would mean either rejecting
 * reasonable titles or appending digits nobody asked for.
 */
export const FALLBACK_BOARD_KEY = 'TASK';

/** Longest key we generate. Keeps `PROD-1234` readable on a task card. */
const MAX_KEY_LENGTH = 4;

export function deriveBoardKey(title: string): string {
  const words = title
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return FALLBACK_BOARD_KEY;
  }

  const raw =
    words.length > 1 ? words.map((word) => word[0]).join('') : words[0].slice(0, MAX_KEY_LENGTH);

  const key = raw.slice(0, MAX_KEY_LENGTH).toUpperCase();
  return key.length > 0 ? key : FALLBACK_BOARD_KEY;
}

/** The display key for a task, e.g. `PR-14`. */
export function formatTaskKey(boardKey: string, number: number): string {
  return `${boardKey}-${number}`;
}
