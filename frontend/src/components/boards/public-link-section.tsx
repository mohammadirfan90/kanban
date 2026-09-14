'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Globe, Link2Off, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiClientError } from '@/lib/api';
import { createPublicLink, getPublicLink, revokePublicLink } from '@/lib/boards';
import type { PublicLink } from '@/lib/types';

export interface PublicLinkSectionProps {
  boardId: string;
  /** Only an OWNER may create, rotate or revoke — and only an OWNER sees the slug. */
  isOwner: boolean;
  /** Called whenever the published state changes, so the board badge stays in step. */
  onChange?: (isPublic: boolean) => void;
}

/** Absolute URL for display, using whatever origin the user is actually on. */
function absoluteUrl(url: string): string {
  if (url.startsWith('http')) return url;
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${url}`;
}

export function PublicLinkSection({ boardId, isOwner, onChange }: PublicLinkSectionProps) {
  const [link, setLink] = useState<PublicLink | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPublicLink(boardId);
      // Owners get the slug; everyone else gets only `{ isPublic }`, so the
      // response has to be narrowed rather than assumed.
      if ('slug' in res) {
        setLink(res);
        setIsPublic(true);
      } else {
        setLink(null);
        setIsPublic(res.isPublic);
      }
    } catch {
      setLink(null);
      setIsPublic(false);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = async (rotating: boolean) => {
    setBusy(true);
    try {
      const created = await createPublicLink(boardId);
      setLink(created);
      setIsPublic(true);
      onChange?.(true);
      toast.success(rotating ? 'New link created — the old one no longer works' : 'Public link created');
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Could not create the link');
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async () => {
    setBusy(true);
    try {
      await revokePublicLink(boardId);
      setLink(null);
      setIsPublic(false);
      onChange?.(false);
      toast.success('Public link turned off');
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Could not turn off the link');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(absoluteUrl(link.url));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select the link and copy manually');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Checking public link…
      </div>
    );
  }

  // Non-owners are told the board is exposed — that changes what they should
  // put on it — but never receive the URL, so they cannot reshare it.
  if (!isOwner) {
    return (
      <div className="border-t pt-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Globe className="h-4 w-4 text-muted-foreground" />
          Public link
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {isPublic
            ? 'This board is readable by anyone with the link. Only the owner can change that.'
            : 'This board is private. Only the owner can publish a link.'}
        </p>
      </div>
    );
  }

  return (
    <div className="border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Globe className="h-4 w-4 text-muted-foreground" />
          Public link
        </div>
        {link && (
          <Button variant="ghost" size="sm" onClick={() => void unpublish()} disabled={busy}>
            <Link2Off className="mr-2 h-3.5 w-3.5" />
            Turn off
          </Button>
        )}
      </div>

      {link ? (
        <>
          <div className="mt-2 flex items-center gap-1.5">
            <Input readOnly value={absoluteUrl(link.url)} className="h-8 text-xs" />
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => void copy()}
              aria-label="Copy public link"
              title="Copy link"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => void publish(true)}
              disabled={busy}
              aria-label="Generate a new link"
              title="Generate a new link (the current one stops working)"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Anyone with this link can read the board — tasks, labels and due dates — without
            signing in. They cannot edit anything. Assignees show as names only.
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a link that lets anyone view this board without an account. They will not be
            able to change anything.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => void publish(false)}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Globe className="mr-2 h-3.5 w-3.5" />
            )}
            Create public link
          </Button>
        </>
      )}
    </div>
  );
}
