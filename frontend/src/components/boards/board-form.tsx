'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ApiClientError } from '@/lib/api';
import { createBoard, updateBoard } from '@/lib/boards';
import type { Board } from '@/lib/types';

const boardSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be at most 100 characters'),
  description: z
    .string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional(),
});

export type BoardFormValues = z.infer<typeof boardSchema>;

interface BoardFormProps {
  /** Existing board to edit. If undefined, the form creates a new board. */
  board?: Board;
  /** Called after a successful save with the saved board. */
  onSaved: (board: Board) => void;
  /** Called when the user clicks the cancel/close control. */
  onCancel: () => void;
}

export function BoardForm({ board, onSaved, onCancel }: BoardFormProps) {
  const isEdit = !!board;
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<BoardFormValues>({
    resolver: zodResolver(boardSchema),
    defaultValues: {
      title: board?.title ?? '',
      description: board?.description ?? '',
    },
  });

  const onSubmit = async (values: BoardFormValues) => {
    setServerError(null);
    try {
      const saved = isEdit
        ? await updateBoard(board.id, {
            title: values.title,
            description: values.description || undefined,
          })
        : await createBoard({
            title: values.title,
            description: values.description || undefined,
          });
      toast.success(isEdit ? 'Board updated' : 'Board created');
      onSaved(saved);
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Could not save board';
      setServerError(msg);
      toast.error(msg);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title *</FormLabel>
              <FormControl>
                <Input placeholder="Q4 product roadmap" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What is this board for?"
                  className="resize-none"
                  rows={3}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormDescription>Optional. Up to 1000 characters.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {serverError && (
          <p className="text-sm text-destructive" role="alert">
            {serverError}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isEdit ? 'Save changes' : 'Create board'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
