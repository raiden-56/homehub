import { useMemo } from 'react';
import { Alert, Stack, Typography } from '@mui/material';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCan, useCommit, useCurrency, useCurrentUser, useMembers, useRecord, useToday } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import { FormDateField, FormMemberSelect, FormMoneyField, FormSelectField, FormSwitch } from '@/components/form/fields';
import { Money } from '@/components/ui/Money';
import { BILL_TO_EXPENSE_CATEGORY, PAYMENT_METHODS } from '@/lib/constants';
import { formatDate } from '@/lib/dates';
import { minorToInput, parseMoneyInput } from '@/lib/money';
import { dateString, moneyString } from '@/lib/validation';
import { newId, nowIso } from '@/lib/ids';
import type { BillOccurrence } from '@/types/models';
import { billPaymentKey, buildBillPayment } from '../logic/payments';
import { draftToSplit, emptySplitDraft, type SplitDraft } from '../logic/splits';
import { SplitEditor } from './SplitEditor';

interface MarkBillPaidDialogProps {
  open: boolean;
  onClose: () => void;
  occurrence: BillOccurrence;
}

/** Records that a bill was paid (outside HomeHub) and optionally adds the matching expense. */
export function MarkBillPaidDialog({ open, onClose, occurrence }: MarkBillPaidDialogProps) {
  const bill = useRecord('bills', occurrence.billId);
  const currency = useCurrency();
  const user = useCurrentUser();
  const members = useMembers();
  const today = useToday();
  const commit = useCommit();
  const canEdit = useCan('edit');
  const memberIds = members.map((member) => member.userId);
  const defaultPayer =
    bill?.payerId && memberIds.includes(bill.payerId) ? bill.payerId : (user?.id ?? memberIds[0] ?? '');

  const schema = useMemo(
    () =>
      z
        .object({
          paidAt: dateString({ required: true, label: 'Payment date' }),
          amount: moneyString({ required: true, currency }),
          payerId: z.string().min(1, 'Choose who paid'),
          paymentMethod: z.string(),
          recordExpense: z.boolean(),
          split: z.custom<SplitDraft>(),
        })
        .superRefine((values, ctx) => {
          if (values.paidAt > today) ctx.addIssue({ code: 'custom', path: ['paidAt'], message: 'Payment date can’t be in the future' });
          if (!values.recordExpense) return;
          const result = draftToSplit(values.split, parseMoneyInput(values.amount, currency), currency);
          if (result.error) ctx.addIssue({ code: 'custom', path: ['split'], message: result.error });
        }),
    [currency, today],
  );
  type Values = z.infer<typeof schema>;

  const { control, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      paidAt: today,
      amount: minorToInput(occurrence.amountMinor, currency),
      payerId: defaultPayer,
      paymentMethod: '',
      recordExpense: true,
      split: emptySplitDraft(memberIds),
    },
  });
  const recordExpense = useWatch({ control, name: 'recordExpense' });
  const amount = useWatch({ control, name: 'amount' });

  const onSubmit = handleSubmit(async (values) => {
    if (!bill) return;
    const amountMinor = parseMoneyInput(values.amount, currency)!;
    const split = values.recordExpense ? draftToSplit(values.split, amountMinor, currency).split : undefined;
    const { changes } = buildBillPayment({
      occurrence,
      bill,
      paidAt: values.paidAt,
      amountMinor,
      payerId: values.payerId,
      recordExpense: values.recordExpense,
      split,
      paymentMethod: values.paymentMethod || undefined,
      expenseId: newId(),
      now: nowIso(),
    });
    const ok = await commit(changes, {
      idempotencyKey: billPaymentKey(occurrence),
      activity: { entity: 'bill', entityId: occurrence.id, message: `Marked “${bill.name}” as paid` },
      success: values.recordExpense ? `${bill.name} marked as paid and added to expenses` : `${bill.name} marked as paid`,
    });
    if (ok) onClose();
  });

  if (!bill) return null;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={`Mark “${bill.name}” as paid`}
      description={
        <>
          Due {formatDate(occurrence.dueDate)} · <Money minor={occurrence.amountMinor} />. This records a payment you made
          elsewhere — HomeHub doesn’t make payments.
        </>
      }
      onSubmit={onSubmit}
      submitLabel="Mark as paid"
      submitting={formState.isSubmitting}
      submitDisabled={!canEdit}
    >
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormDateField control={control} name="paidAt" label="Payment date" required />
          <FormMoneyField control={control} name="amount" label="Amount paid" required />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormMemberSelect control={control} name="payerId" label="Paid by" emptyLabel={null} includeViewers />
          <FormSelectField
            control={control}
            name="paymentMethod"
            label="Payment method (optional)"
            emptyLabel="Not specified"
            options={PAYMENT_METHODS.map((method) => ({ value: method, label: method }))}
          />
        </Stack>
        <FormSwitch
          control={control}
          name="recordExpense"
          label="Record as a household expense"
          helperText={`Adds an expense in “${BILL_TO_EXPENSE_CATEGORY[bill.category] ?? 'Other'}” so budgets and reports include it.`}
        />
        {recordExpense && (
          <Controller
            control={control}
            name="split"
            render={({ field, fieldState }) => (
              <SplitEditor
                value={field.value}
                onChange={field.onChange}
                totalMinor={parseMoneyInput(amount, currency)}
                error={fieldState.error?.message}
              />
            )}
          />
        )}
        {occurrence.state === 'cancelled' && (
          <Alert severity="info">This bill was cancelled. Marking it paid will restore it as paid.</Alert>
        )}
        {!canEdit && (
          <Typography variant="body2" color="text.secondary">
            Viewers can’t record payments.
          </Typography>
        )}
      </Stack>
    </FormDialog>
  );
}
