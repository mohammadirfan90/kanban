'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiClientError } from '@/lib/api';
import { shareBoard } from '@/lib/boards';
import { lookupUserByEmail } from '@/lib/users';
import { UserSearchInput } from './user-search-input';
import type { Board } from '@/lib/types';

const shareSchema = z.object({
  email: z.string().email('Enter a valid email'),
  role: z.enum(['EDITOR', 'VIEWER']),
});

type ShareFormValues = z.infer<typeof shareSchema>;

export interface ShareBoardDialogProps {
  board: Board;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful share with the updated board from the server. */
  onShared: (board: Board) => void;
}

export function ShareBoardDialog({ board, open, onOpenChange, onShared }: ShareBoardDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ShareFormValues>({
    resolver: zodResolver(shareSchema),
    defaultValues: { email: '', role: 'EDITOR' },
  });

  const reset = () => {
    form.reset({ email: '', role: 'EDITOR' });
    setServerError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const onSubmit = async (values: ShareFormValues) => {
    setServerError(null);
    try {
      // 1. Resolve email → userId.
      const target = await lookupUserByEmail(values.email);

      // 2. Share the board.
      const updated = await shareBoard(board.id, {
        userId: target.id,
        role: values.role,
      });

      toast.success(`Invitation sent to ${target.email}`);
      onShared(updated);
      reset();
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.status === 404) {
          // From lookupUserByEmail — user doesn't exist.
          toast.error('User not found');
          return;
        }
        if (e.status === 409) {
          toast.error('Already a member');
          return;
        }
        // Self-share 400, or any other server error.
        setServerError(e.message);
        toast.error(e.message);
        return;
      }
      const msg = e instanceof Error ? e.message : 'Could not share board';
      setServerError(msg);
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Share &ldquo;{board.title}&rdquo;
          </DialogTitle>
          <DialogDescription>
            Invite a teammate by email. They&apos;ll get EDITOR (can add/edit tasks) or VIEWER
            (read-only) access immediately.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <UserSearchInput
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      disabled={form.formState.isSubmitting}
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={form.formState.isSubmitting}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EDITOR">Editor — can add and edit tasks</SelectItem>
                        <SelectItem value="VIEWER">Viewer — read only</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {serverError && (
              <p className="text-sm text-destructive" role="alert">
                {serverError}
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send invitation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
