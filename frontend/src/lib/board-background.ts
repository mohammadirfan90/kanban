/**
 * Board canvas backgrounds.
 *
 * The server stores only a token (see backend/src/boards/board-background.ts);
 * this file is the palette that resolves it. Keeping the values here rather
 * than in the database is what lets one token mean a soft tint in light mode
 * and a deep muted wash in dark mode, and lets the palette be re-tuned without
 * touching a single row.
 *
 * Every entry is a gradient rather than a flat fill because a large empty
 * canvas shows banding badly; a gentle two-stop gradient reads as a surface
 * instead of a painted rectangle.
 */

export interface BoardBackground {
  token: string;
  label: string;
  /** Light-mode canvas. */
  light: string;
  /** Dark-mode canvas — same hue, far lower luminance so cards stay readable. */
  dark: string;
  /** Small solid chip for the picker. */
  swatch: string;
}

export const BOARD_BACKGROUNDS: BoardBackground[] = [
  {
    token: 'mist',
    label: 'Mist',
    light: 'linear-gradient(160deg, #d7dee8 0%, #c3cddb 100%)',
    dark: 'linear-gradient(160deg, #1a2030 0%, #141926 100%)',
    swatch: '#c3cddb',
  },
  {
    token: 'sky',
    label: 'Sky',
    light: 'linear-gradient(160deg, #a9d6f5 0%, #7cbdea 100%)',
    dark: 'linear-gradient(160deg, #10243a 0%, #0c1b2c 100%)',
    swatch: '#7cbdea',
  },
  {
    token: 'ocean',
    label: 'Ocean',
    light: 'linear-gradient(160deg, #8fb6ee 0%, #6d95dd 100%)',
    dark: 'linear-gradient(160deg, #101f3d 0%, #0b172e 100%)',
    swatch: '#6d95dd',
  },
  {
    token: 'dusk',
    label: 'Dusk',
    light: 'linear-gradient(160deg, #b9b3e0 0%, #9c95d2 100%)',
    dark: 'linear-gradient(160deg, #1d1b33 0%, #151427 100%)',
    swatch: '#9c95d2',
  },
  {
    token: 'lilac',
    label: 'Lilac',
    light: 'linear-gradient(160deg, #d3b4f0 0%, #bd93e6 100%)',
    dark: 'linear-gradient(160deg, #241a35 0%, #1a1428 100%)',
    swatch: '#bd93e6',
  },
  {
    token: 'rose',
    label: 'Rose',
    light: 'linear-gradient(160deg, #f6afb9 0%, #ee8b9c 100%)',
    dark: 'linear-gradient(160deg, #2e1a20 0%, #221318 100%)',
    swatch: '#ee8b9c',
  },
  {
    token: 'ember',
    label: 'Ember',
    light: 'linear-gradient(160deg, #f8c58a 0%, #efa662 100%)',
    dark: 'linear-gradient(160deg, #2d2013 0%, #21170e 100%)',
    swatch: '#efa662',
  },
  {
    token: 'forest',
    label: 'Forest',
    light: 'linear-gradient(160deg, #9adcb4 0%, #6fc795 100%)',
    dark: 'linear-gradient(160deg, #10251a 0%, #0c1b13 100%)',
    swatch: '#6fc795',
  },
  {
    token: 'clay',
    label: 'Clay',
    light: 'linear-gradient(160deg, #e2d6c1 0%, #d0bfa3 100%)',
    dark: 'linear-gradient(160deg, #26211b 0%, #1b1714 100%)',
    swatch: '#d0bfa3',
  },
  {
    token: 'slate',
    label: 'Slate',
    light: 'linear-gradient(160deg, #c3c8d0 0%, #aab1bc 100%)',
    dark: 'linear-gradient(160deg, #1c1f24 0%, #15171b 100%)',
    swatch: '#aab1bc',
  },
];

const BY_TOKEN = new Map(BOARD_BACKGROUNDS.map((b) => [b.token, b]));

export function findBackground(token: string | null | undefined): BoardBackground | null {
  return token ? (BY_TOKEN.get(token) ?? null) : null;
}

/**
 * CSS custom properties for a board canvas.
 *
 * Returned as variables rather than a `background` value so the stylesheet can
 * pick the light or dark one with a media query. Setting `background` directly
 * from JS would need the current theme, which is not known during SSR and would
 * flash the wrong colour on first paint.
 */
export function backgroundStyle(token: string | null | undefined): React.CSSProperties {
  const bg = findBackground(token);
  if (!bg) return {};
  return {
    ['--board-canvas-light' as string]: bg.light,
    ['--board-canvas-dark' as string]: bg.dark,
  };
}
