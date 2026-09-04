'use client';

import { useEffect, useRef, useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { z } from 'zod';

const emailSchema = z.string().email('Enter a valid email');
const DEBOUNCE_MS = 300;

export interface UserSearchInputProps {
  value: string;
  onChange: (v: string) => void;
  onValidityChange?: (isValid: boolean) => void;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Controlled email input with 300ms-debounced zod validation.
 *
 * The debounce applies to LOCAL validation (email format), NOT to any backend
 * lookup — see Spec 09. The actual /api/users/lookup call happens on form
 * submit in `share-board-dialog`.
 */
export function UserSearchInput({
  value,
  onChange,
  onValidityChange,
  error,
  disabled,
  autoFocus,
}: UserSearchInputProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear the timer on unmount.
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Re-validate whenever value changes (with debounce).
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    // Empty input — not an error per se, just not valid yet.
    if (value.length === 0) {
      setLocalError(null);
      setValidating(false);
      onValidityChange?.(false);
      return;
    }

    setValidating(true);
    timerRef.current = setTimeout(() => {
      const result = emailSchema.safeParse(value);
      if (result.success) {
        setLocalError(null);
        onValidityChange?.(true);
      } else {
        const msg = result.error.issues[0]?.message ?? 'Invalid email';
        setLocalError(msg);
        onValidityChange?.(false);
      }
      setValidating(false);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, onValidityChange]);

  const displayError = error ?? localError ?? undefined;

  return (
    <div className="relative">
      <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="email"
        inputMode="email"
        autoComplete="off"
        placeholder="teammate@example.com"
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={!!displayError}
        className="pl-8 pr-8"
        onChange={(e) => onChange(e.target.value)}
      />
      {validating && (
        <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {displayError && !validating && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {displayError}
        </p>
      )}
    </div>
  );
}
