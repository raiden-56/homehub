import { useEffect } from 'react';
import { Stack } from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useActiveHousehold, useCan, useCollection, useCommit, useCurrency, useToday } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import {
  FormDateField,
  FormMemberSelect,
  FormMoneyField,
  FormRecurrenceField,
  FormSelectField,
  FormTextField,
} from '@/components/form/fields';
import { minorToInput, parseMoneyInput } from '@/lib/money';
import { newId, nowIso } from '@/lib/ids';
import {
  blankToUndefined,
  dateString,
  formToRecurrence,
  moneyString,
  optionalText,
  recurrenceFormSchema,
  recurrenceToForm,
  requiredText,
} from '@/lib/validation';
import type { MaintenanceTask } from '@/types/models';

const schema = z.object({
  name: requiredText('Task name', 120),
  assetId: z.string(),
  description: optionalText(1000),
  dueDate: dateString({ required: true, label: 'Due date' }),
  recurrence: recurrenceFormSchema,
  priority: z.enum(['low', 'medium', 'high']),
  assigneeId: z.string(),
  provider: optionalText(120),
  estimatedCost: moneyString({ label: 'Estimated cost' }),
  notes: optionalText(1000),
});
type FormValues = z.infer<typeof schema>;

interface MaintenanceTaskDialogProps {
  open: boolean;
  onClose: () => void;
  task?: MaintenanceTask;
  /** Prefills the related asset when scheduling from an asset page. */
  assetId?: string;
}

export function MaintenanceTaskDialog({ open, onClose, task, assetId }: MaintenanceTaskDialogProps) {
  const household = useActiveHousehold();
  const assets = useCollection('assets');
  const currency = useCurrency();
  const today = useToday();
  const canEdit = useCan('edit');
  const commit = useCommit();

  const defaults = (): FormValues => ({
    name: task?.name ?? '',
    assetId: task?.assetId ?? assetId ?? '',
    description: task?.description ?? '',
    dueDate: task?.dueDate ?? today,
    recurrence: recurrenceToForm(task?.recurrence),
    priority: task?.priority ?? 'medium',
    assigneeId: task?.assigneeId ?? '',
    provider: task?.provider ?? '',
    estimatedCost: minorToInput(task?.estimatedCostMinor, currency),
    notes: task?.notes ?? '',
  });

  const { control, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  });

  useEffect(() => {
    if (open) reset(defaults());
    // Reset only when opening or switching record.
  }, [open, task?.id]);

  const assetOptions = assets
    .filter((asset) => !asset.archived || asset.id === task?.assetId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((asset) => ({ value: asset.id, label: asset.name }));

  const save = handleSubmit(async (values) => {
    if (!household) return;
    const now = nowIso();
    const recurrence = formToRecurrence(values.recurrence);
    const estimated = values.estimatedCost.trim() ? (parseMoneyInput(values.estimatedCost, currency) ?? undefined) : undefined;
    const id = task?.id ?? newId();
    const record: MaintenanceTask = {
      ...(task ?? { status: 'scheduled', documentIds: [], createdAt: now }),
      id,
      householdId: household.id,
      name: values.name.trim(),
      assetId: values.assetId || undefined,
      description: blankToUndefined(values.description),
      dueDate: values.dueDate,
      recurrence,
      seriesId: recurrence ? (task?.seriesId ?? id) : task?.seriesId,
      priority: values.priority,
      assigneeId: values.assigneeId || undefined,
      provider: blankToUndefined(values.provider),
      estimatedCostMinor: estimated,
      notes: blankToUndefined(values.notes),
      updatedAt: now,
    };
    const ok = await commit(
      { put: { maintenanceTasks: [record] } },
      {
        activity: { entity: 'maintenance', entityId: id, message: task ? `Updated maintenance “${record.name}”` : `Scheduled maintenance “${record.name}”` },
        success: task ? 'Maintenance updated' : 'Maintenance scheduled',
        undo: task ? { put: { maintenanceTasks: [task] } } : { remove: { maintenanceTasks: [id] } },
      },
    );
    if (ok) onClose();
  });

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={task ? 'Edit maintenance' : 'Schedule maintenance'}
      submitLabel={task ? 'Save changes' : 'Schedule'}
      onSubmit={save}
      submitting={formState.isSubmitting}
      submitDisabled={!canEdit}
    >
      <Stack spacing={2}>
        <FormTextField control={control} name="name" label="Task name" required placeholder="e.g. AC wet service" autoFocus={!task} />
        <FormSelectField control={control} name="assetId" label="Related asset" options={assetOptions} emptyLabel="No specific asset" />
        <FormTextField control={control} name="description" label="Description" multiline minRows={2} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormDateField control={control} name="dueDate" label="Due date" required />
          <FormSelectField
            control={control}
            name="priority"
            label="Priority"
            options={[
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
          />
        </Stack>
        <FormRecurrenceField control={control} name="recurrence" />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormMemberSelect control={control} name="assigneeId" label="Assigned to" />
          <FormTextField control={control} name="provider" label="Service provider" />
        </Stack>
        <FormMoneyField control={control} name="estimatedCost" label="Estimated cost" helperText="Optional — used for planning only" />
        <FormTextField control={control} name="notes" label="Notes" multiline minRows={2} />
      </Stack>
    </FormDialog>
  );
}
