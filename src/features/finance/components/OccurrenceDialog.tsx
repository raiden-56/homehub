import { useMemo } from 'react';
import { Stack } from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCan, useCommit, useCurrency } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import { FormDateField, FormMoneyField, FormTextField } from '@/components/form/fields';
import { minorToInput, parseMoneyInput } from '@/lib/money';
import { blankToUndefined, dateString, moneyString, optionalText } from '@/lib/validation';
import { nowIso } from '@/lib/ids';
import type { BillOccurrence } from '@/types/models';

/** Edits a single occurrence (this bill only) without changing the series. */
export function OccurrenceDialog({
  open,
  onClose,
  occurrence,
  billName,
}: {
  open: boolean;
  onClose: () => void;
  occurrence: BillOccurrence;
  billName: string;
}) {
  const currency = useCurrency();
  const commit = useCommit();
  const canEdit = useCan('edit');
  const schema = useMemo(
    () =>
      z.object({
        amount: moneyString({ required: true, currency }),
        dueDate: dateString({ required: true, label: 'Due date' }),
        notes: optionalText(500),
      }),
    [currency],
  );
  type Values = z.infer<typeof schema>;
  const { control, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: minorToInput(occurrence.amountMinor, currency),
      dueDate: occurrence.dueDate,
      notes: occurrence.notes ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const ok = await commit(
      {
        put: {
          billOccurrences: [
            {
              ...occurrence,
              amountMinor: parseMoneyInput(values.amount, currency)!,
              dueDate: values.dueDate,
              notes: blankToUndefined(values.notes),
              updatedAt: nowIso(),
            },
          ],
        },
      },
      {
        activity: { entity: 'bill', entityId: occurrence.id, message: `Updated one occurrence of “${billName}”` },
        success: 'Bill updated',
      },
    );
    if (ok) onClose();
  });

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Edit this bill only"
      description={`Changes apply to this occurrence of “${billName}”, not the rest of the series.`}
      onSubmit={onSubmit}
      submitting={formState.isSubmitting}
      submitDisabled={!canEdit}
      maxWidth="xs"
    >
      <Stack spacing={2}>
        <FormMoneyField control={control} name="amount" label="Amount" required />
        <FormDateField control={control} name="dueDate" label="Due date" required />
        <FormTextField control={control} name="notes" label="Notes" multiline minRows={2} />
      </Stack>
    </FormDialog>
  );
}
