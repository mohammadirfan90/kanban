import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * A public board link is a capability URL: whoever holds it can read the
 * board. A capability URL that a crawler has indexed is no longer a
 * capability, so this subtree is marked noindex.
 *
 * The API sends `X-Robots-Tag: noindex` on the data response for the same
 * reason; this covers the HTML page, which is what a crawler would actually
 * find if a link were pasted somewhere public.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function PublicBoardLayout({ children }: { children: ReactNode }) {
  return children;
}
