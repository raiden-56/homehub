import { useMemo } from 'react';
import { Alert, Stack } from '@mui/material';
import { useForm, useWatch } from 'react-hook-form';
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
import { BILL_CATEGORIES } from '@/lib/constants';
import { minorToInput, parseMoneyInput } from '@/lib/money';
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
import { newId, nowIso } from '@/lib/ids';
import type { Bill } from '@/types/models';
import { buildSeriesUpdate } from '../logic/payments';

interface BillDialogProps {
  open: boolean;
  onClose: () => void;
  /** Existing series to edit; omit to create a bill. */
  bill?: Bill;
}

/** Create a bill or edit a recurring series. */
export function BillDialog({ open, onClose, bill }: BillDialogProps) {
  const household = useActiveHousehold();
  const currency = useCurrency();
  const today = useToday();
  const occurrences = useCollection('billOccurrences');
  const commit = useCommit();
  const canEdit = useCan('edit');

  const schema = useMemo(
    () =>
      z.object({
        name: requiredText('Bill name', 80),
        category: z.string().min(1, 'Choose a category'),
        amount: moneyString({ required: true, currency }),
        startDate: dateString({ required: true, label: 'Due date' }),
        recurrence: recurrenceFormSchema,
        payerId: z.string(),
        notes: optionalText(500),
      }),
    [currency],
  );
  type Values = z.infer<typeof schema>;

  const { control, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: bill?.name ?? '',
      category: bill?.category ?? 'Electricity',
      amount: minorToInput(bill?.amountMinor, currency),
      startDate: bill?.startDate ?? today,
      recurrence: bill ? recurrenceToForm(bill.recurrence) : { repeat: 'monthly', interval: '1', weekdays: [], until: '' },
      payerId: bill?.payerId ?? '',
      notes: bill?.notes ?? '',
    },
  });
  const repeat = useWatch({ control, name: 'recurrence.repeat' });

  const onSubmit = handleSubmit(async (values) => {
    if (!household) return;
    const now = nowIso();
    const next: Bill = {
      id: bill?.id ?? newId(),
      householdId: household.id,
      name: values.name.trim(),
      category: values.category,
      amountMinor: parseMoneyInput(values.amount, currency)!,
      startDate: values.startDate,
      recurrence: formToRecurrence(values.recurrence),
      payerId: values.payerId || undefined,
      notes: blankToUndefined(values.notes),
      documentId: bill?.documentId,
      active: bill?.active ?? true,
      createdAt: bill?.createdAt ?? now,
      updatedAt: now,
    };
    const changes = buildSeriesUpdate(bill, next, occurrences, today, now);
    const ok = await commit(changes, {
      activity: { entity: 'bill', entityId: next.id, message: bill ? `Updated the bill “${next.name}”` : `Added the bill “${next.name}”` },
      success: bill ? 'Bill updated' : 'Bill added',
    });
    if (ok) onClose();
  });

  const categories = bill && !BILL_CATEGORIES.includes(bill.category) ? [...BILL_CATEGORIES, bill.category] : BILL_CATEGORIES;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={bill ? 'Edit bill' : 'Add bill'}
      description={bill?.recurrence ? 'Changes apply to the whole series.' : 'Track an amount your household owes.'}
      onSubmit={onSubmit}
      submitLabel={bill ? 'Save changes' : 'Add bill'}
      submitting={formState.isSubmitting}
      submitDisabled={!canEdit}
    >
      <Stack spacing={2}>
        <FormTextField control={control} name="name" label="Bill name" required placeholder="e.g. Electricity" autoFocus={!bill} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormSelectField
            control={control}
            name="category"
            label="Category"
            options={categories.map((category) => ({ value: category, label: category }))}
          />
          <FormMoneyField control={control} name="amount" label="Expected amount" required />
        </Stack>
        <FormDateField
          control={control}
          name="startDate"
          label={repeat === 'none' ? 'Due date' : 'First due date'}
          required
          helperText={repeat === 'none' ? undefined : 'Later bills follow this date’s schedule.'}
        />
        <FormRecurrenceField control={control} name="recurrence" allowed={['none', 'weekly', 'monthly', 'quarterly', 'yearly']} />
        <FormMemberSelect control={control} name="payerId" label="Usually paid by" emptyLabel="Not set" includeViewers />
        <FormTextField control={control} name="notes" label="Notes" multiline minRows={2} />
        {bill?.recurrence && (
          <Alert severity="info">
            Changing the amount or schedule updates unpaid upcoming bills. Paid and past bills keep their recorded amounts.
          </Alert>
        )}
      </Stack>
    </FormDialog>
  );
}
