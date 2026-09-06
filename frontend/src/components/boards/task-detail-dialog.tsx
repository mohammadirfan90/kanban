'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Pencil, Trash2, UserCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
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
import { DueDate, LabelChip, PriorityIndicator } from './task-meta';
import type { BoardLabel, BoardMemberView, BoardTask, TaskPriority } from '@/lib/types';

const editSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
  description: z.string().max(5000, 'Description must be at most 5000 characters').optional(),
  // "__unassigned__" sentinel maps to "no assignee" on save.
  assigneeId: z.string().optional(),
});

/** Form-shape submitted to onSave. Exported so parents can type-check. */
export type TaskEditValues = Omit<z.infer<typeof editSchema>, 'assigneeId'> & {
  assigneeId: string | null;
  priority: TaskPriority | null;
  dueDate: string | null;
  labelIds: string[];
};

type EditValues = z.infer<typeof editSchema>;

const UNASSIGNED = '__unassigned__';

export interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: BoardTask | null;
  members: BoardMemberView[];
  boardId: string;
  boardLabels: BoardLabel[];
  /** Lifts a label created from inside the dialog into the board's list. */
  onLabelCreated?: (label: BoardLabel) => void;
  canEdit: boolean;
  onSave: (taskId: string, values: TaskEditValues) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

export function TaskDetailDialog({
  open,
  onOpenChange,
  task,
  members,
  boardId,
  boardLabels,
  onLabelCreated,
  canEdit,
  onSave,
  onDelete,
}: TaskDetailDialogProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Priority, due date and labels are not text inputs, so they sit outside
  // react-hook-form. They re-seed whenever a different task is opened — the
  // dialog instance is reused across tasks, so without this the second task
  // opened would inherit the first one's values.
  const [priority, setPriority] = useState<TaskPriority | null>(task?.priority ?? null);
  const [dueDate, setDueDate] = useState<string | null>(task?.dueDate ?? null);
  const [labelIds, setLabelIds] = useState<string[]>(task?.labels.map((l) => l.id) ?? []);

  useEffect(() => {
    setPriority(task?.priority ?? null);
    setDueDate(task?.dueDate ?? null);
    setLabelIds(task?.labels.map((l) => l.id) ?? []);
  }, [task]);

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    values: task
      ? {
          title: task.title,
          description: task.description ?? '',
          assigneeId: task.assignee?.id ?? UNASSIGNED,
        }
      : { title: '', description: '', assigneeId: UNASSIGNED },
  });

  // When the task changes, reset into view mode.
  const taskId = task?.id;
  if (taskId !== undefined && mode === 'edit' && form.formState.isSubmitSuccessful) {
    setMode('view');
  }

  const reset = () => {
    setMode('view');
    setServerError(null);
    setConfirmDelete(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleDeleteClick = () => setConfirmDelete(true);

  const handleConfirmDelete = async () => {
    if (!task) return;
    setDeleting(true);
    try {
      await onDelete(task.id);
      toast.success('Task deleted');
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Could not delete task';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (values: EditValues) => {
    if (!task) return;
    setServerError(null);
    try {
      await onSave(task.id, {
        title: values.title,
        description: values.description,
        assigneeId:
          values.assigneeId && values.assigneeId !== UNASSIGNED ? values.assigneeId : null,
        priority,
        dueDate,
        labelIds,
      });
      toast.success('Task saved');
      setMode('view');
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Could not save task';
      setServerError(msg);
      toast.error(msg);
    }
  };

  if (!task) return null;

  return (
    <>
      <Dialog
        open={open && !confirmDelete}
        onOpenChange={handleOpenChange}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">
              <span className="font-mono text-sm text-muted-foreground">{task.key}</span>
            </DialogTitle>
            <DialogDescription>
              {mode === 'view' ? 'View task details' : 'Edit task details'}
            </DialogDescription>
          </DialogHeader>

          {mode === 'view' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold leading-tight tracking-tight">
                  {task.title}
                </h3>
                {(task.priority || task.dueDate || task.labels.length > 0) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    {task.priority && <PriorityIndicator priority={task.priority} showLabel />}
                    {task.dueDate && <DueDate dueDate={task.dueDate} />}
                    {task.labels.map((label) => (
                      <LabelChip key={label.id} label={label} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Description
                </p>
                {task.description ? (
                  <p className="mt-1 whitespace-pre-line text-sm">{task.description}</p>
                ) : (
                  <p className="mt-1 text-sm italic text-muted-foreground/70">No description</p>
                )}
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Assignee
                </p>
                {task.assignee ? (
                  <div className="mt-1 flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarFallback>{initials(task.assignee.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{task.assignee.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {task.assignee.email}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-2 text-sm italic text-muted-foreground/70">
                    <UserCircle2 className="h-4 w-4" />
                    Unassigned
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  <X className="mr-2 h-4 w-4" />
                  Close
                </Button>
                {canEdit && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteClick}
                      title="Delete task"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                    <Button onClick={() => setMode('edit')}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </>
                )}
              </DialogFooter>
            </div>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-4"
                noValidate
              >
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input autoFocus {...field} />
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
                          className="resize-none"
                          rows={5}
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
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
                    onClick={() => setMode('view')}
                    disabled={form.formState.isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save changes
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{task.title}</strong> will be permanently deleted. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
