'use client';

import dynamic from 'next/dynamic';

/**
 * Dev-only visual feedback overlay from agentation. Mounted in the root
 * layout so it's available on every route during `next dev` (and stripped
 * from production builds via the dynamic import + `ssr: false`).
 *
 * Per package docs, the canonical mount pattern is:
 *   {process.env.NODE_ENV === 'development' && <Agentation />}
 * We use dynamic() with ssr:false so the import (and its ~200KB of UI
 * code) is excluded from the production bundle entirely.
 */
const Agentation = dynamic(
  () => import('agentation').then((mod) => mod.Agentation),
  { ssr: false },
);

export function DevOverlay() {
  if (process.env.NODE_ENV !== 'development') return null;
  return <Agentation />;
}
