import { ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const logger = new Logger('OrderingRetry');

/** Prisma error codes that mean "someone else won the race; read again". */
const RETRYABLE = new Set<string>([
  'P2002', // unique constraint violation — another writer took this position key
  'P2034', // transaction write conflict / deadlock
]);

/**
 * Contenders for one slot can only be satisfied one per round: the winner takes
 * the key, and everyone else must re-read before they can compute a different
 * one. So the attempt ceiling is really "how many simultaneous writers to a
 * single index do we absorb before telling a client to refetch". Measured with
 * 8 clients racing for index 0, five attempts starved two of them; ten absorbs
 * the burst with room to spare, and costs nothing in the common uncontended
 * case where the first attempt succeeds.
 */
export const DEFAULT_ORDERING_ATTEMPTS = 10;

/** Base unit for the retry backoff, in milliseconds. */
const BACKOFF_BASE_MS = 8;

/** Ceiling per retry, so a long attempt chain stays inside a request budget. */
const BACKOFF_CAP_MS = 100;

function isRetryable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && RETRYABLE.has(error.code);
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Exponential backoff with full jitter: `random(0, base * 2^(attempt-1))`.
 *
 * The jitter is the important half. Without it, every loser of a collision
 * retries at the same instant and collides again — measured with 8 clients
 * racing for one slot, that reliably starved one of them into a 409. Spreading
 * retries across a widening window lets contenders settle into distinct slots
 * instead of resonating.
 *
 * Delays stay small (8ms, 16ms, 32ms, 64ms, then capped at 100ms) because this
 * contends on a single index page, not a remote service; the goal is to
 * desynchronise callers, not to wait out a slow dependency. Worst case across
 * all ten attempts is well under a second.
 */
function backoffMs(attempt: number): number {
  return Math.random() * Math.min(BACKOFF_BASE_MS * 2 ** (attempt - 1), BACKOFF_CAP_MS);
}

/**
 * Run an ordering write, retrying when a concurrent writer claims the same
 * position key.
 *
 * Why this rather than SERIALIZABLE
 * ---------------------------------
 * Concurrent reorders race in one specific way: two callers read the same
 * neighbours and therefore compute the *same* key. Fractional indexing does
 * not fix that on its own — `keyBetween('a1','a2')` is deterministic, so both
 * callers get `a1V`.
 *
 * Two ways to make that safe:
 *
 *   - SERIALIZABLE isolation. Postgres SSI spots the read-write dependency and
 *     aborts one transaction with 40001. Correct, but it also aborts on
 *     *false* conflicts (any overlapping read set in the column), so a busy
 *     board retries far more often than it needs to.
 *
 *   - A unique index on `(parentId, position)` plus this retry loop. The
 *     database rejects only the genuine collision — the exact key already
 *     being taken. The loser re-reads, now sees the winner's key among the
 *     siblings, and computes a different one. It converges because each retry
 *     strictly shrinks the contended gap.
 *
 * We take the second: the failure it guards against is precise, so the guard
 * should be precise too. `RETRYABLE` deliberately does not include generic
 * errors — a validation failure or a missing row must surface immediately
 * rather than being retried.
 *
 * @param operation Re-reads its inputs on every attempt. It MUST NOT close
 *   over neighbour keys computed outside the loop, or a retry would recompute
 *   the same colliding key forever.
 */
export async function withOrderingRetry<T>(
  operation: () => Promise<T>,
  context: string,
  attempts: number = DEFAULT_ORDERING_ATTEMPTS,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryable(error)) {
        throw error;
      }
      lastError = error;
      logger.debug(`${context}: position conflict on attempt ${attempt}/${attempts}, retrying`);

      if (attempt < attempts) {
        await sleep(backoffMs(attempt));
      }
    }
  }

  // Exhausting the whole chain means sustained contention on one gap, not a
  // transient race. Surfacing 409 lets the client refetch and retry from the
  // true current order instead of hammering a slot it keeps losing.
  logger.warn(`${context}: gave up after ${attempts} position conflicts`);
  throw new ConflictException(
    'Could not place the item: too many concurrent reorders. Please retry.',
    { cause: lastError },
  );
}
