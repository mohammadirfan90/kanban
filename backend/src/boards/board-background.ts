/**
 * Board canvas backgrounds.
 *
 * Stored as a TOKEN, never a hex value or a URL — the same rule Label.color
 * follows. Three reasons that matters here:
 *
 *  1. The client owns the palette, so a token can resolve to different values
 *     in light and dark themes. A stored hex cannot.
 *  2. The value ends up in a style attribute. Accepting an arbitrary string
 *     would let a member write whatever they liked into every viewer's CSS,
 *     including anyone holding a public link.
 *  3. The palette can be re-tuned later without a data migration.
 *
 * `null` means the default surface, which is what every existing board has.
 */
export const BOARD_BACKGROUNDS = [
  'mist',
  'sky',
  'ocean',
  'dusk',
  'lilac',
  'ember',
  'rose',
  'forest',
  'slate',
  'clay',
] as const;

export type BoardBackground = (typeof BOARD_BACKGROUNDS)[number];
