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
    light: 'linear-gradient(160deg, #eef2f7 0%, #e2e8f0 100%)',
    dark: 'linear-gradient(160deg, #1a2030 0%, #141926 100%)',
    swatch: '#e2e8f0',
  },
  {
    token: 'sky',
    label: 'Sky',
    light: 'linear-gradient(160deg, #e0f2fe 0%, #cfe6fb 100%)',
    dark: 'linear-gradient(160deg, #10243a 0%, #0c1b2c 100%)',
    swatch: '#bae6fd',
  },
  {
    token: 'ocean',
    label: 'Ocean',
    light: 'linear-gradient(160deg, #dbeafe 0%, #bfd8f7 100%)',
    dark: 'linear-gradient(160deg, #101f3d 0%, #0b172e 100%)',
    swatch: '#bfdbfe',
  },
  {
    token: 'dusk',
    label: 'Dusk',
    light: 'linear-gradient(160deg, #e7e5f5 0%, #d6d2ee 100%)',
    dark: 'linear-gradient(160deg, #1d1b33 0%, #151427 100%)',
    swatch: '#ddd6fe',
  },
  {
    token: 'lilac',
    label: 'Lilac',
    light: 'linear-gradient(160deg, #f3e8ff 0%, #e6d5fb 100%)',
    dark: 'linear-gradient(160deg, #241a35 0%, #1a1428 100%)',
    swatch: '#e9d5ff',
  },
  {
    token: 'rose',
    label: 'Rose',
    light: 'linear-gradient(160deg, #ffe4e6 0%, #fbd0d5 100%)',
    dark: 'linear-gradient(160deg, #2e1a20 0%, #221318 100%)',
    swatch: '#fecdd3',
  },
  {
    token: 'ember',
    label: 'Ember',
    light: 'linear-gradient(160deg, #ffedd5 0%, #fcdcb8 100%)',
    dark: 'linear-gradient(160deg, #2d2013 0%, #21170e 100%)',
    swatch: '#fed7aa',
  },
  {
    token: 'forest',
    label: 'Forest',
    light: 'linear-gradient(160deg, #dcfce7 0%, #c2eed4 100%)',
    dark: 'linear-gradient(160deg, #10251a 0%, #0c1b13 100%)',
    swatch: '#bbf7d0',
  },
  {
    token: 'clay',
    label: 'Clay',
    light: 'linear-gradient(160deg, #f5f0e8 0%, #e9e1d3 100%)',
    dark: 'linear-gradient(160deg, #26211b 0%, #1b1714 100%)',
    swatch: '#e7e0d1',
  },
  {
    token: 'slate',
    label: 'Slate',
    light: 'linear-gradient(160deg, #e5e7eb 0%, #d1d5db 100%)',
    dark: 'linear-gradient(160deg, #1c1f24 0%, #15171b 100%)',
    swatch: '#d1d5db',
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
