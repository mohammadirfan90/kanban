import { deriveBoardKey, formatTaskKey, FALLBACK_BOARD_KEY } from './board-key';

describe('deriveBoardKey', () => {
  it('uses initials when the title has several words', () => {
    expect(deriveBoardKey('Product Roadmap')).toBe('PR');
    expect(deriveBoardKey('Design System Working Group')).toBe('DSWG');
  });

  it('uses the leading characters of a single word', () => {
    expect(deriveBoardKey('Phronesis')).toBe('PHRO');
    expect(deriveBoardKey('Ops')).toBe('OPS');
  });

  it('caps the key at four characters', () => {
    expect(deriveBoardKey('One Two Three Four Five Six')).toBe('OTTF');
    expect(deriveBoardKey('Extraordinarily')).toBe('EXTR');
  });

  it('treats punctuation and symbols as separators', () => {
    expect(deriveBoardKey('Q3 / Delivery')).toBe('QD');
    expect(deriveBoardKey('back-end   work')).toBe('BEW');
    expect(deriveBoardKey('  Padded  Title  ')).toBe('PT');
  });

  it('keeps digits, since they are legitimate initials', () => {
    expect(deriveBoardKey('2026 Planning')).toBe('2P');
  });

  it('falls back when the title has nothing usable', () => {
    expect(deriveBoardKey('###')).toBe(FALLBACK_BOARD_KEY);
    expect(deriveBoardKey('   ')).toBe(FALLBACK_BOARD_KEY);
    expect(deriveBoardKey('')).toBe(FALLBACK_BOARD_KEY);
  });

  it('always returns something usable as a key', () => {
    const titles = ['a', 'A B', '1', '— —', 'ünïcodé', 'Tasks!!!'];
    for (const title of titles) {
      const key = deriveBoardKey(title);
      expect(key.length).toBeGreaterThan(0);
      expect(key.length).toBeLessThanOrEqual(4);
      expect(key).toBe(key.toUpperCase());
      expect(key).toMatch(/^[A-Z0-9]+$/);
    }
  });
});

describe('formatTaskKey', () => {
  it('joins the board key and the task number', () => {
    expect(formatTaskKey('PR', 14)).toBe('PR-14');
    expect(formatTaskKey('TASK', 1)).toBe('TASK-1');
  });
});
