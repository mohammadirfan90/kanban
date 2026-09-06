'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus } from 'lucide-react';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiClientError } from '@/lib/api';
import { DueDateField, LabelField, PriorityField } from './task-fields';
import type { BoardLabel, BoardMemberView, TaskPriority } from '@/lib/types';

const createSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
  description: z.string().max(5000, 'Description must be at most 5000 characters').optional(),
  assigneeId: z.string().optional(),
});

export type CreateTaskFormValues = z.infer<typeof createSchema> & {
  priority?: TaskPriority | null;
  dueDate?: string | null;
  labelIds?: string[];
};

const UNASSIGNED = '__unassigned__';

export interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId: string;
  columnTitle: string;
  members: BoardMemberView[];
  boardId: string;
  boardLabels: BoardLabel[];
  /** Lifts a label created from inside the dialog into the board's list. */
  onLabelCreated?: (label: BoardLabel) => void;
  /** Called with the form values when submit succeeds. */
  onCreate: (columnId: string, values: CreateTaskFormValues) => Promise<void>;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  columnId,
  columnTitle,
  members,
  boardId,
  boardLabels,
  onLabelCreated,
  onCreate,
}: CreateTaskDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  // Outside react-hook-form for the same reason as the detail dialog: none of
  // these are text inputs, and zod adds nothing over the typed setters.
  const [priority, setPriority] = useState<TaskPriority | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [labelIds, setLabelIds] = useState<string[]>([]);

  const form = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: '', description: '', assigneeId: '' },
  });

  const reset = () => {
    form.reset({ title: '', description: '', assigneeId: '' });
    setPriority(null);
    setDueDate(null);
    setLabelIds([]);
    setServerError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const onSubmit = async (values: CreateTaskFormValues) => {
    setServerError(null);
    try {
      await onCreate(columnId, {
        title: values.title,
        description: values.description?.trim() || undefined,
        // Treat the sentinel as "no assignee" — pass undefined.
        assigneeId: values.assigneeId && values.assigneeId !== UNASSIGNED ? values.assigneeId : undefined,
        priority,
        dueDate,
        labelIds,
      });
      toast.success('Task created');
      reset();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Could not create task';
      setServerError(msg);
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New task in &ldquo;{columnTitle}&rdquo;
          </DialogTitle>
          <DialogDescription>
            Give it a clear title. You can add a description and assignee after creating it.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Write a release announcement" autoFocus {...field} />
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
                      placeholder="Optional context for the assignee"
                      className="resize-none"
                      rows={3}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormDescription>Optional. Up to 5000 characters.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assigneeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assignee</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ?? UNASSIGNED}
                      onValueChange={field.onChange}
                      disabled={form.formState.isSubmitting}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.userId} value={m.userId}>
                            {m.name} ({m.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <PriorityField
              value={priority}
              onChange={setPriority}
              disabled={form.formState.isSubmitting}
            />

            <DueDateField
              value={dueDate}
              onChange={setDueDate}
              disabled={form.formState.isSubmitting}
            />

            <LabelField
              boardId={boardId}
              boardLabels={boardLabels}
              selectedIds={labelIds}
              onChange={setLabelIds}
              onLabelCreated={onLabelCreated}
              disabled={form.formState.isSubmitting}
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
                Create task
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
