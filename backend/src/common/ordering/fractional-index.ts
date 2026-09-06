/**
 * Fractional indexing for stable, conflict-free ordering.
 *
 * Why not floats
 * --------------
 * The original implementation stored `position` as a Float and inserted at the
 * midpoint of two neighbours. That has two failure modes:
 *
 *   1. Precision exhaustion. Repeatedly inserting at the head does
 *      `first.position / 2`, halving toward zero. Float64 runs out of
 *      representable midpoints after ~50 inserts between the same pair, at
 *      which point two distinct rows collapse onto one value. The previous
 *      code mitigated this with a periodic full-column renumber, which is an
 *      O(n) write amplification on an interactive drag.
 *
 *   2. Concurrent inserts converge. Two clients that both read `[1, 2]` and
 *      both insert "between" compute the *same* midpoint 1.5. Nothing in the
 *      arithmetic makes the result depend on who went first.
 *
 * Fractional indexing (base62 strings, ordered lexicographically) fixes (1)
 * outright: there is always a key strictly between any two distinct keys, so
 * no rebalance pass is ever needed. It does not by itself fix (2) — two
 * concurrent callers reading the same neighbours still generate the same key —
 * which is why `TasksService.move` runs under SERIALIZABLE isolation with a
 * unique index on `[columnId, position]` as the backstop. See
 * `withOrderingRetry` there.
 *
 * Key shape
 * ---------
 * Keys look like `a0`, `a1`, ..., `a0V`, `b00`. The first character encodes the
 * length of the integer part; everything after it is a base62 fraction that
 * never ends in `0`. Ordering is plain lexicographic `<`, so Postgres can sort
 * on the column directly with no collation surprises (all characters are
 * ASCII alphanumerics).
 *
 * @see https://observablehq.com/@dgreensp/implementing-fractional-indexing
 */
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

/** A lexicographically-ordered position key. */
export type OrderKey = string;

/**
 * The key used for the very first item in an empty collection.
 * Exported so callers don't have to know that `keyBetween(null, null)` is the
 * idiom for "first key".
 */
export function firstKey(): OrderKey {
  return generateKeyBetween(null, null);
}

/**
 * A key strictly between `before` and `after`.
 *
 * `null` means "unbounded on that side": `keyBetween(null, x)` is a key that
 * sorts before `x`, `keyBetween(x, null)` sorts after it, and
 * `keyBetween(null, null)` is the first key.
 *
 * The ordering guard below is ours, not the library's: given reversed
 * neighbours, `generateKeyBetween('a2', 'a1')` returns `'a1V'` — a key that is
 * outside the requested interval — rather than raising. Silently writing that
 * would corrupt the column's order, so we fail loudly instead. Equal
 * neighbours do throw in the library, but with the message `" >="`, which
 * tells an on-call engineer nothing.
 *
 * @throws {RangeError} if `before >= after`.
 */
export function keyBetween(before: OrderKey | null, after: OrderKey | null): OrderKey {
  if (before !== null && after !== null && before >= after) {
    throw new RangeError(
      `keyBetween: neighbours must be strictly ascending, got before=${before} after=${after}`,
    );
  }
  return generateKeyBetween(before, after);
}

/**
 * `n` evenly-distributed keys strictly between `before` and `after`.
 * Used when seeding a board's default columns, so they don't all collide.
 */
export function keysBetween(
  before: OrderKey | null,
  after: OrderKey | null,
  n: number,
): OrderKey[] {
  if (n < 0) {
    throw new RangeError(`keysBetween: n must be >= 0, got ${n}`);
  }
  return generateNKeysBetween(before, after, n);
}

/**
 * The key an item needs in order to land at `index` among `siblings`.
 *
 * `siblings` must be the target collection's keys in ascending order **with
 * the moved item already excluded** — otherwise the item would be treated as
 * its own neighbour and the computed key could equal the one it already has.
 *
 * `index` is clamped to `[0, siblings.length]`, so an out-of-range index from
 * a stale client appends rather than throwing. That is the friendlier
 * behaviour for a drag that raced against someone else's delete.
 */
export function keyForIndex(siblings: readonly OrderKey[], index: number): OrderKey {
  const clamped = Math.max(0, Math.min(index, siblings.length));
  const before = clamped > 0 ? siblings[clamped - 1] : null;
  const after = clamped < siblings.length ? siblings[clamped] : null;
  return keyBetween(before, after);
}
