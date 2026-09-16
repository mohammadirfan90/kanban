'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/**
 * A single initial, not two.
 *
 * "MI" reads as a label; "M" reads as a person. At avatar size the second
 * letter costs legibility and buys nothing — every product that shows a
 * monogram avatar (Linear, Notion, Slack) uses one character.
 */
export function monogram(name: string | null | undefined): string {
  const first = (name ?? '').trim().charAt(0);
  return first ? first.toUpperCase() : '?';
}

export interface UserAvatarProps {
  name: string | null | undefined;
  /** Provider profile picture. Google accounts have one; password accounts do not. */
  avatarUrl?: string | null;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

/**
 * The one avatar in the app.
 *
 * Replaces seven near-identical `initials()` helpers that had already drifted —
 * some trimmed, some did not, some returned two letters from a single-word name
 * and some one. A monogram is a fallback, so it has to be identical everywhere
 * or the same person appears differently on the card and in the member list.
 *
 * `AvatarImage` degrades to the fallback on its own if the URL 404s, which
 * matters because Google rotates profile picture URLs.
 */
export function UserAvatar({ name, avatarUrl, size = 'sm', className }: UserAvatarProps) {
  return (
    <Avatar size={size} className={cn(className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" /> : null}
      <AvatarFallback>{monogram(name)}</AvatarFallback>
    </Avatar>
  );
}
