import { useMemo } from 'react';
import { Stack } from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useActiveHousehold, useAppSelector, useCan, useCommit, useCurrency, useToday } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import { FormDateField, FormMemberSelect, FormMoneyField, FormTextField } from '@/components/form/fields';
import { formatMoney, minorToInput, parseMoneyInput } from '@/lib/money';
import { blankToUndefined, dateString, moneyString, optionalText } from '@/lib/validation';
import { newId, nowIso } from '@/lib/ids';
import type { Settlement } from '@/types/models';

interface SettlementDialogProps {
  open: boolean;
  onClose: () => void;
  /** Prefill from a suggested transfer. */
  defaults?: { fromUserId?: string; toUserId?: string; amountMinor?: number };
}

/** Records money one member paid another to settle shared expenses. */
export function SettlementDialog({ open, onClose, defaults }: SettlementDialogProps) {
  const household = useActiveHousehold();
  const currency = useCurrency();
  const today = useToday();
  const commit = useCommit();
  const canEdit = useCan('edit');
  const users = useAppSelector((state) => state.data.users);

  const schema = useMemo(
    () =>
      z
        .object({
          fromUserId: z.string().min(1, 'Choose who paid'),
          toUserId: z.string().min(1, 'Choose who received the money'),
          amount: moneyString({ required: true, currency }),
          date: dateString({ required: true }),
          note: optionalText(200),
        })
        .refine((values) => values.fromUserId !== values.toUserId, {
          path: ['toUserId'],
          message: 'Choose two different people',
        })
        .refine((values) => values.date <= today, { path: ['date'], message: 'Date can’t be in the future' }),
    [currency, today],
  );
  type Values = z.infer<typeof schema>;

  const { control, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fromUserId: defaults?.fromUserId ?? '',
      toUserId: defaults?.toUserId ?? '',
      amount: minorToInput(defaults?.amountMinor, currency),
      date: today,
      note: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!household) return;
    const now = nowIso();
    const settlement: Settlement = {
      id: newId(),
      householdId: household.id,
      fromUserId: values.fromUserId,
      toUserId: values.toUserId,
      amountMinor: parseMoneyInput(values.amount, currency)!,
      date: values.date,
      note: blankToUndefined(values.note),
      createdAt: now,
      updatedAt: now,
    };
    const from = users[settlement.fromUserId]?.name ?? 'Someone';
    const to = users[settlement.toUserId]?.name ?? 'someone';
    const ok = await commit(
      { put: { settlements: [settlement] } },
      {
        activity: {
          entity: 'settlement',
          entityId: settlement.id,
          message: `Recorded ${from} paying ${to} ${formatMoney(settlement.amountMinor, currency)}`,
        },
        success: 'Settlement recorded',
        undo: { remove: { settlements: [settlement.id] } },
      },
    );
    if (ok) onClose();
  });

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Record a settlement"
      description="Log money paid between members outside HomeHub. Balances update immediately."
      onSubmit={onSubmit}
      submitLabel="Record settlement"
      submitting={formState.isSubmitting}
      submitDisabled={!canEdit}
      maxWidth="xs"
    >
      <Stack spacing={2}>
        <FormMemberSelect control={control} name="fromUserId" label="Paid by" emptyLabel={null} includeViewers />
        <FormMemberSelect control={control} name="toUserId" label="Paid to" emptyLabel={null} includeViewers />
        <FormMoneyField control={control} name="amount" label="Amount" required />
        <FormDateField control={control} name="date" label="Date" required />
        <FormTextField control={control} name="note" label="Note (optional)" placeholder="e.g. UPI transfer" />
      </Stack>
    </FormDialog>
  );
}
