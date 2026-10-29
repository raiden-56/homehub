import { useEffect, useState } from 'react';
import { Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material';
import { Plus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useActiveHousehold, useAppSelector, useCan, useCommit, useCurrentUser } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import {
  FormDateField,
  FormMemberSelect,
  FormRecurrenceField,
  FormSelectField,
  FormTextField,
  FormTimeField,
} from '@/components/form/fields';
import {
  NO_RECURRENCE,
  blankToUndefined,
  dateString,
  formToRecurrence,
  optionalText,
  recurrenceFormSchema,
  recurrenceToForm,
  requiredText,
  timeString,
} from '@/lib/validation';
import { TASK_CATEGORIES } from '@/lib/constants';
import { newId, nowIso } from '@/lib/ids';
import type { ChecklistItem, Task } from '@/types/models';
import { PRIORITY_LABELS, REMINDER_OPTIONS } from '../logic';

const schema = z
  .object({
    title: requiredText('Title', 120),
    description: optionalText(2000),
    category: z.string().min(1, 'Choose a category'),
    assigneeId: z.string(),
    dueDate: dateString(),
    dueTime: timeString(),
    priority: z.enum(['low', 'medium', 'high']),
    status: z.enum(['not_started', 'in_progress']),
    recurrence: recurrenceFormSchema,
    reminder: z.string(),
    notes: optionalText(2000),
  })
  .superRefine((value, ctx) => {
    if (value.recurrence.repeat !== 'none' && !value.dueDate) {
      ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Repeating tasks need a first due date' });
    }
    if (value.dueTime && !value.dueDate) {
      ctx.addIssue({ code: 'custom', path: ['dueTime'], message: 'Add a due date to set a time' });
    }
    if (value.reminder !== '' && !value.dueDate) {
      ctx.addIssue({ code: 'custom', path: ['reminder'], message: 'Reminders need a due date' });
    }
    if (value.recurrence.until && value.dueDate && value.recurrence.until < value.dueDate) {
      ctx.addIssue({ code: 'custom', path: ['recurrence'], message: 'The end date must be after the first due date' });
    }
  });

type FormValues = z.infer<typeof schema>;

function toForm(task: Task | undefined, defaults: { dueDate?: string; assigneeId?: string } | undefined): FormValues {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    category: task?.category ?? 'Cleaning',
    assigneeId: task?.assigneeId ?? defaults?.assigneeId ?? '',
    dueDate: task?.dueDate ?? defaults?.dueDate ?? '',
    dueTime: task?.dueTime ?? '',
    priority: task?.priority ?? 'medium',
    status: task?.status === 'in_progress' ? 'in_progress' : 'not_started',
    recurrence: task ? recurrenceToForm(task.recurrence) : { ...NO_RECURRENCE },
    reminder: task?.reminderMinutesBefore !== undefined ? String(task.reminderMinutesBefore) : '',
    notes: task?.notes ?? '',
  };
}

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  task?: Task;
  defaults?: { dueDate?: string; assigneeId?: string };
}

/** Create or edit a task (chore). Completing a task is done from the list, board or details. */
export function TaskDialog({ open, onClose, task, defaults }: TaskDialogProps) {
  const household = useActiveHousehold();
  const user = useCurrentUser();
  const canEdit = useCan('edit');
  const commit = useCommit();
  const tasks = useAppSelector((state) => state.data.tasks);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task?.checklist ?? []);
  const [newItem, setNewItem] = useState('');

  const { control, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toForm(task, defaults),
  });

  useEffect(() => {
    if (open) {
      reset(toForm(task, defaults));
      setChecklist(task?.checklist ?? []);
      setNewItem('');
    }
    // Reset only when the dialog opens or the edited task changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const addChecklistItem = () => {
    const text = newItem.trim();
    if (!text) return;
    setChecklist((items) => [...items, { id: newId(), text: text.slice(0, 200), done: false }]);
    setNewItem('');
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!household || !user) return;
    const now = nowIso();
    const recurrence = formToRecurrence(values.recurrence);
    const pendingItem = newItem.trim();
    const finalChecklist = pendingItem ? [...checklist, { id: newId(), text: pendingItem.slice(0, 200), done: false }] : checklist;
    const fields = {
      title: values.title,
      description: blankToUndefined(values.description),
      category: values.category,
      assigneeId: values.assigneeId || undefined,
      dueDate: values.dueDate || undefined,
      dueTime: values.dueDate ? values.dueTime || undefined : undefined,
      priority: values.priority,
      recurrence,
      reminderMinutesBefore: values.reminder === '' ? undefined : Number(values.reminder),
      notes: blankToUndefined(values.notes),
      checklist: finalChecklist,
    };

    if (task) {
      const updated: Task = {
        ...task,
        ...fields,
        status: task.status === 'completed' ? 'completed' : values.status,
        seriesId: recurrence ? (task.seriesId ?? task.id) : task.seriesId,
        updatedAt: now,
      };
      const ok = await commit(
        { put: { tasks: [updated] } },
        {
          activity: { entity: 'task', entityId: task.id, message: `Updated “${updated.title}”` },
          success: 'Task updated',
          undo: { put: { tasks: [task] } },
        },
      );
      if (ok) onClose();
      return;
    }

    const id = newId();
    const maxOrder = Object.values(tasks)
      .filter((other) => other.status === values.status)
      .reduce((max, other) => Math.max(max, other.boardOrder), 0);
    const created: Task = {
      id,
      householdId: household.id,
      ...fields,
      status: values.status,
      seriesId: recurrence ? id : undefined,
      comments: [],
      boardOrder: maxOrder + 1,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    };
    const ok = await commit(
      { put: { tasks: [created] } },
      {
        activity: { entity: 'task', entityId: id, message: `Created the task “${created.title}”` },
        success: `Task “${created.title}” created`,
        undo: { remove: { tasks: [id] } },
      },
    );
    if (ok) onClose();
  });

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={task ? 'Edit task' : 'New task'}
      onSubmit={onSubmit}
      submitLabel={task ? 'Save changes' : 'Create task'}
      submitting={formState.isSubmitting}
      submitDisabled={!canEdit}
      maxWidth="sm"
    >
      <Stack spacing={2}>
        <FormTextField control={control} name="title" label="Title" required autoFocus placeholder="e.g. Clean the kitchen" />
        <FormTextField control={control} name="description" label="Description" multiline minRows={2} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormSelectField
            control={control}
            name="category"
            label="Category"
            options={TASK_CATEGORIES.map((value) => ({ value, label: value }))}
          />
          <FormMemberSelect control={control} name="assigneeId" label="Assigned to" />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormDateField control={control} name="dueDate" label="Due date" />
          <FormTimeField control={control} name="dueTime" label="Due time (optional)" />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormSelectField
            control={control}
            name="priority"
            label="Priority"
            options={(['high', 'medium', 'low'] as const).map((value) => ({ value, label: PRIORITY_LABELS[value] }))}
          />
          {task?.status !== 'completed' && (
            <FormSelectField
              control={control}
              name="status"
              label="Status"
              options={[
                { value: 'not_started', label: 'Not started' },
                { value: 'in_progress', label: 'In progress' },
              ]}
            />
          )}
        </Stack>
        <FormRecurrenceField control={control} name="recurrence" />
        {formState.errors.recurrence?.message && (
          <Typography variant="caption" color="error">
            {formState.errors.recurrence.message}
          </Typography>
        )}
        <FormSelectField
          control={control}
          name="reminder"
          label="Reminder"
          options={REMINDER_OPTIONS.filter((option) => option.value !== '')}
          emptyLabel="No reminder"
          helperText="Shown as an in-app reminder in HomeHub. No email or push message is sent."
        />

        <Box>
          <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
            Checklist (optional)
          </Typography>
          <Stack spacing={0.5}>
            {checklist.map((item, index) => (
              <Stack key={item.id} direction="row" spacing={1} alignItems="center">
                <TextField
                  value={item.text}
                  onChange={(event) =>
                    setChecklist((items) =>
                      items.map((entry) => (entry.id === item.id ? { ...entry, text: event.target.value.slice(0, 200) } : entry)),
                    )
                  }
                  slotProps={{ htmlInput: { 'aria-label': `Checklist item ${index + 1}` } }}
                />
                <IconButton
                  aria-label={`Remove checklist item ${item.text || index + 1}`}
                  onClick={() => setChecklist((items) => items.filter((entry) => entry.id !== item.id))}
                >
                  <X size={16} />
                </IconButton>
              </Stack>
            ))}
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                value={newItem}
                placeholder="Add a step"
                onChange={(event) => setNewItem(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addChecklistItem();
                  }
                }}
                slotProps={{ htmlInput: { 'aria-label': 'New checklist item' } }}
              />
              <Button onClick={addChecklistItem} startIcon={<Plus size={16} />} disabled={!newItem.trim()} sx={{ flexShrink: 0 }}>
                Add
              </Button>
            </Stack>
          </Stack>
        </Box>

        <FormTextField control={control} name="notes" label="Notes" multiline minRows={2} />
      </Stack>
    </FormDialog>
  );
}
