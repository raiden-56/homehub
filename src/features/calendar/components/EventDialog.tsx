import { useEffect } from 'react';
import { Checkbox, ListItemText, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useActiveHousehold, useCan, useCommit, useCurrentUser, useMembers, useToday } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import {
  FormDateField,
  FormRecurrenceField,
  FormSelectField,
  FormSwitch,
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
import { newId, nowIso } from '@/lib/ids';
import type { CalendarEvent, EventCategory } from '@/types/models';
import { EVENT_CATEGORY_LABELS } from '../sources';
import { REMINDER_OPTIONS } from '@/features/tasks/logic';

const schema = z
  .object({
    title: requiredText('Title', 120),
    category: z.enum(['household', 'appointment', 'social', 'reminder', 'other']),
    allDay: z.boolean(),
    date: dateString({ required: true, label: 'Start date' }),
    endDate: dateString(),
    startTime: timeString(),
    endTime: timeString(),
    location: optionalText(160),
    memberIds: z.array(z.string()),
    description: optionalText(2000),
    recurrence: recurrenceFormSchema,
    reminder: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.endDate && value.date && value.endDate < value.date) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'The end date can’t be before the start date' });
    }
    if (!value.allDay) {
      if (!value.startTime) ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'Add a start time, or mark the event as all day' });
      const sameDay = !value.endDate || value.endDate === value.date;
      if (value.startTime && value.endTime && sameDay && value.endTime <= value.startTime) {
        ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'The end time must be after the start time' });
      }
    }
    if (value.recurrence.until && value.date && value.recurrence.until < value.date) {
      ctx.addIssue({ code: 'custom', path: ['recurrence'], message: 'The repeat end date must be after the start date' });
    }
  });

type FormValues = z.infer<typeof schema>;

function toForm(event: CalendarEvent | undefined, defaultDate: string): FormValues {
  return {
    title: event?.title ?? '',
    category: event?.category ?? 'household',
    allDay: event?.allDay ?? false,
    date: event?.date ?? defaultDate,
    endDate: event?.endDate ?? '',
    startTime: event?.startTime ?? (event ? '' : '18:00'),
    endTime: event?.endTime ?? '',
    location: event?.location ?? '',
    memberIds: event?.memberIds ?? [],
    description: event?.description ?? '',
    recurrence: event ? recurrenceToForm(event.recurrence) : { ...NO_RECURRENCE },
    reminder: event?.reminderMinutesBefore !== undefined ? String(event.reminderMinutesBefore) : '',
  };
}

interface EventDialogProps {
  open: boolean;
  onClose: () => void;
  event?: CalendarEvent;
  defaultDate?: string;
}

export function EventDialog({ open, onClose, event, defaultDate }: EventDialogProps) {
  const household = useActiveHousehold();
  const user = useCurrentUser();
  const members = useMembers();
  const canEdit = useCan('edit');
  const commit = useCommit();
  const today = useToday();
  const { control, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toForm(event, defaultDate ?? today),
  });
  const allDay = useWatch({ control, name: 'allDay' });

  useEffect(() => {
    if (open) reset(toForm(event, defaultDate ?? today));
    // Reset when the dialog opens for a different event or day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id, defaultDate]);

  const onSubmit = handleSubmit(async (values) => {
    if (!household || !user) return;
    const now = nowIso();
    const fields = {
      title: values.title,
      category: values.category as EventCategory,
      allDay: values.allDay,
      date: values.date,
      endDate: values.endDate && values.endDate !== values.date ? values.endDate : undefined,
      startTime: values.allDay ? undefined : values.startTime || undefined,
      endTime: values.allDay ? undefined : values.endTime || undefined,
      location: blankToUndefined(values.location),
      memberIds: values.memberIds,
      description: blankToUndefined(values.description),
      recurrence: formToRecurrence(values.recurrence),
      reminderMinutesBefore: values.reminder === '' ? undefined : Number(values.reminder),
    };
    if (event) {
      const updated: CalendarEvent = { ...event, ...fields, updatedAt: now };
      const ok = await commit(
        { put: { events: [updated] } },
        {
          activity: { entity: 'event', entityId: event.id, message: `Updated the event “${updated.title}”` },
          success: event.recurrence ? 'Event series updated' : 'Event updated',
          undo: { put: { events: [event] } },
        },
      );
      if (ok) onClose();
      return;
    }
    const created: CalendarEvent = { id: newId(), householdId: household.id, ...fields, createdBy: user.id, createdAt: now, updatedAt: now };
    const ok = await commit(
      { put: { events: [created] } },
      {
        activity: { entity: 'event', entityId: created.id, message: `Added the event “${created.title}”` },
        success: `“${created.title}” added to the calendar`,
        undo: { remove: { events: [created.id] } },
      },
    );
    if (ok) onClose();
  });

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={event ? 'Edit event' : 'New event'}
      description={event?.recurrence ? 'Changes apply to every occurrence in this series.' : undefined}
      onSubmit={onSubmit}
      submitLabel={event ? 'Save changes' : 'Create event'}
      submitting={formState.isSubmitting}
      submitDisabled={!canEdit}
    >
      <Stack spacing={2}>
        <FormTextField control={control} name="title" label="Title" required autoFocus placeholder="e.g. Plumber visit" />
        <FormSelectField
          control={control}
          name="category"
          label="Type"
          options={Object.entries(EVENT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <FormSwitch control={control} name="allDay" label="All day" />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormDateField control={control} name="date" label="Start date" required />
          <FormDateField control={control} name="endDate" label="End date (optional)" helperText="For events lasting several days" />
        </Stack>
        {!allDay && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormTimeField control={control} name="startTime" label="Start time" required />
            <FormTimeField control={control} name="endTime" label="End time (optional)" />
          </Stack>
        )}
        <FormTextField control={control} name="location" label="Location (optional)" />
        <Controller
          control={control}
          name="memberIds"
          render={({ field }) => (
            <TextField
              select
              label="Who’s involved"
              value={field.value}
              onChange={(changeEvent) => {
                const value = changeEvent.target.value as unknown;
                field.onChange(typeof value === 'string' ? value.split(',') : value);
              }}
              helperText="Leave empty for the whole household"
              slotProps={{
                select: {
                  multiple: true,
                  renderValue: (selected) =>
                    (selected as string[]).map((id) => members.find((member) => member.userId === id)?.name ?? 'Former member').join(', '),
                },
              }}
            >
              {members.map((member) => (
                <MenuItem key={member.userId} value={member.userId}>
                  <Checkbox checked={field.value.includes(member.userId)} sx={{ p: 0, mr: 1 }} />
                  <ListItemText primary={member.name} />
                </MenuItem>
              ))}
            </TextField>
          )}
        />
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
          helperText="An in-app reminder inside HomeHub. No email or push message is sent."
        />
        <FormTextField control={control} name="description" label="Notes" multiline minRows={2} />
      </Stack>
    </FormDialog>
  );
}
