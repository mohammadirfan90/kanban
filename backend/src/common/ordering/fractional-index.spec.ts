import { firstKey, keyBetween, keyForIndex, keysBetween, type OrderKey } from './fractional-index';

/** Apply a move to an ordered list and return the resulting order. */
function applyMove(keys: OrderKey[], movedIndex: number, targetIndex: number): OrderKey[] {
  const siblings = keys.filter((_, i) => i !== movedIndex);
  const next = keyForIndex(siblings, targetIndex);
  const out = [...siblings];
  out.splice(Math.min(targetIndex, siblings.length), 0, next);
  return out;
}

const isSorted = (keys: readonly OrderKey[]): boolean =>
  keys.every((k, i) => i === 0 || keys[i - 1] < k);

describe('fractional-index', () => {
  describe('firstKey / keyBetween', () => {
    it('produces a key for an empty collection', () => {
      expect(firstKey()).toBe('a0');
    });

    it('orders before / between / after correctly', () => {
      const a = firstKey();
      const before = keyBetween(null, a);
      const after = keyBetween(a, null);
      const middle = keyBetween(a, after);

      expect(before < a).toBe(true);
      expect(a < middle).toBe(true);
      expect(middle < after).toBe(true);
    });

    it('rejects neighbours passed out of order', () => {
      expect(() => keyBetween('a2', 'a1')).toThrow(RangeError);
    });

    it('rejects equal neighbours', () => {
      expect(() => keyBetween('a1', 'a1')).toThrow(RangeError);
    });
  });

  describe('keysBetween', () => {
    it('returns n distinct ascending keys', () => {
      const keys = keysBetween(null, null, 5);
      expect(keys).toHaveLength(5);
      expect(new Set(keys).size).toBe(5);
      expect(isSorted(keys)).toBe(true);
    });

    it('returns an empty array for n = 0', () => {
      expect(keysBetween(null, null, 0)).toEqual([]);
    });

    it('fits n keys inside an arbitrarily tight gap', () => {
      const lo = 'a0';
      const hi = keyBetween(lo, 'a1');
      const keys = keysBetween(lo, hi, 10);

      expect(keys).toHaveLength(10);
      expect(isSorted(keys)).toBe(true);
      expect(lo < keys[0]).toBe(true);
      expect(keys[9] < hi).toBe(true);
    });

    it('rejects a negative count', () => {
      expect(() => keysBetween(null, null, -1)).toThrow(RangeError);
    });
  });

  describe('keyForIndex', () => {
    const siblings = keysBetween(null, null, 4); // a0 a1 a2 a3

    it('sorts before every sibling at index 0', () => {
      const key = keyForIndex(siblings, 0);
      expect(key < siblings[0]).toBe(true);
    });

    it('sorts after every sibling at index = length', () => {
      const key = keyForIndex(siblings, siblings.length);
      expect(key > siblings[siblings.length - 1]).toBe(true);
    });

    it('lands strictly between the neighbours at an interior index', () => {
      const key = keyForIndex(siblings, 2);
      expect(siblings[1] < key).toBe(true);
      expect(key < siblings[2]).toBe(true);
    });

    it('returns the first key for an empty collection', () => {
      expect(keyForIndex([], 0)).toBe(firstKey());
    });

    it('clamps an index beyond the end instead of throwing', () => {
      // A stale client can send an index for a list that has since shrunk.
      const key = keyForIndex(siblings, 999);
      expect(key > siblings[siblings.length - 1]).toBe(true);
    });

    it('clamps a negative index instead of throwing', () => {
      const key = keyForIndex(siblings, -5);
      expect(key < siblings[0]).toBe(true);
    });
  });

  describe('ordering invariants under repeated moves', () => {
    it('never exhausts precision when repeatedly inserting at the head', () => {
      // The float implementation collapsed after ~50 iterations of `first / 2`.
      let keys = keysBetween(null, null, 2);
      for (let i = 0; i < 1_000; i++) {
        keys = [keyBetween(null, keys[0]), ...keys];
      }
      expect(new Set(keys).size).toBe(keys.length);
      expect(isSorted(keys)).toBe(true);
    });

    it('never exhausts precision when repeatedly inserting into the same gap', () => {
      let lo = 'a0';
      const hi = 'a1';
      const seen = new Set<string>([lo, hi]);
      for (let i = 0; i < 1_000; i++) {
        const mid = keyBetween(lo, hi);
        expect(lo < mid && mid < hi).toBe(true);
        expect(seen.has(mid)).toBe(false);
        seen.add(mid);
        lo = mid;
      }
    });

    it('keeps a total order across a long random shuffle', () => {
      let keys = keysBetween(null, null, 12);
      // Deterministic pseudo-random walk so failures reproduce.
      let seed = 42;
      const rand = (n: number) => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed % n;
      };

      for (let i = 0; i < 500; i++) {
        keys = applyMove(keys, rand(keys.length), rand(keys.length + 1));
        expect(new Set(keys).size).toBe(keys.length);
        expect(isSorted(keys)).toBe(true);
      }
      expect(keys).toHaveLength(12);
    });

    it('moving an item onto its own index is a no-op for ordering', () => {
      const keys = keysBetween(null, null, 5);
      const moved = applyMove(keys, 2, 2);
      expect(isSorted(moved)).toBe(true);
      expect(moved).toHaveLength(5);
    });
  });

  describe('backfill key shape', () => {
    // The 20260906 migration synthesises keys as 'a0' + the row's 1-based
    // ordinal zero-padded to 6 digits, with a trailing '1' appended when the
    // padding would otherwise end in '0' (a fractional part may not end in
    // '0'). Fixed-width decimal means lexicographic order == ordinal order.
    //
    //   row 1   -> 'a0' + '000001' -> 'a0000001'
    //   row 2   -> 'a0' + '000002' -> 'a0000002'
    //   row 10  -> 'a0' + '000010' -> ends in '0' -> 'a00000101'
    //   row 100 -> 'a0' + '000100' -> ends in '0' -> 'a00001001'
    const backfill = (ordinal: number): OrderKey => {
      const key = `a0${String(ordinal).padStart(6, '0')}`;
      return key.endsWith('0') ? `${key}1` : key;
    };
    const backfilled = [1, 2, 9, 10, 11, 99, 100, 101, 999_999].map(backfill);

    it('emits the documented key for representative rows', () => {
      expect(backfill(1)).toBe('a0000001');
      expect(backfill(2)).toBe('a0000002');
      expect(backfill(10)).toBe('a00000101');
      expect(backfill(100)).toBe('a00001001');
    });

    it('sorts backfilled keys in ordinal order', () => {
      expect(isSorted(backfilled)).toBe(true);
    });

    it('accepts backfilled keys as neighbours', () => {
      for (let i = 1; i < backfilled.length; i++) {
        const mid = keyBetween(backfilled[i - 1], backfilled[i]);
        expect(backfilled[i - 1] < mid && mid < backfilled[i]).toBe(true);
      }
      expect(() => keyBetween(backfilled[backfilled.length - 1], null)).not.toThrow();
    });
  });
});
