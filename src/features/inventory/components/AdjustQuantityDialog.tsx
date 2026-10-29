import { useEffect, useState } from 'react';
import { Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCan, useCommit, useCurrentUser } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import { FormNumberField, FormTextField } from '@/components/form/fields';
import type { InventoryItem } from '@/types/models';
import { numberString, optionalText, toNumber } from '@/lib/validation';
import { buildQuantityChange } from '../hooks';
import { formatQuantity, roundQuantity } from '../logic';

export type AdjustMode = 'consume' | 'restock' | 'adjust';

const MODE_COPY: Record<AdjustMode, { label: string; field: string; submit: string; verb: string }> = {
  consume: { label: 'Use', field: 'Amount used', submit: 'Record use', verb: 'Used' },
  restock: { label: 'Restock', field: 'Amount added', submit: 'Add stock', verb: 'Restocked' },
  adjust: { label: 'Set exact', field: 'New quantity', submit: 'Update quantity', verb: 'Adjusted' },
};

const schema = z.object({ amount: numberString({ required: true, label: 'Amount', min: 0 }), note: optionalText(200) });
type FormValues = z.infer<typeof schema>;

interface AdjustQuantityDialogProps {
  open: boolean;
  onClose: () => void;
  item: InventoryItem;
  mode?: AdjustMode;
}

/** Records consumption, restocking or a correction as an inventory movement. */
export function AdjustQuantityDialog({ open, onClose, item, mode: initialMode = 'consume' }: AdjustQuantityDialogProps) {
  const [mode, setMode] = useState<AdjustMode>(initialMode);
  const commit = useCommit();
  const user = useCurrentUser();
  const canEdit = useCan('edit');
  const { control, handleSubmit, reset, setError, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', note: '' },
  });

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      reset({ amount: initialMode === 'adjust' ? String(item.quantity) : '', note: '' });
    }
  }, [open, initialMode, item.quantity, reset]);

  const amountText = watch('amount');
  const amount = Number(amountText);
  const valid = amountText.trim() !== '' && Number.isFinite(amount) && amount >= 0;
  const next =
    mode === 'consume' ? item.quantity - amount : mode === 'restock' ? item.quantity + amount : amount;

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return;
    const value = toNumber(values.amount);
    if (mode !== 'adjust' && value === 0) {
      setError('amount', { message: 'Enter an amount greater than zero' });
      return;
    }
    const target = roundQuantity(mode === 'consume' ? item.quantity - value : mode === 'restock' ? item.quantity + value : value);
    if (target < 0) {
      setError('amount', { message: `Only ${formatQuantity(item.quantity)} ${item.unit} available` });
      return;
    }
    if (target === item.quantity) {
      setError('amount', { message: 'That doesn’t change the quantity' });
      return;
    }
    const change = buildQuantityChange(item, target, mode, user.id, values.note);
    const ok = await commit(
      { put: { inventoryItems: [change.item], inventoryMovements: [change.movement] } },
      {
        success: `${item.name}: ${formatQuantity(target)} ${item.unit} left`,
        undo: { put: { inventoryItems: [item] }, remove: { inventoryMovements: [change.movement.id] } },
        activity: {
          entity: 'inventory',
          entityId: item.id,
          message: `${MODE_COPY[mode].verb} “${item.name}” (${formatQuantity(item.quantity)} → ${formatQuantity(target)} ${item.unit})`,
        },
      },
    );
    if (ok) onClose();
  });

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={`Update stock · ${item.name}`}
      description={`Currently ${formatQuantity(item.quantity)} ${item.unit}`}
      onSubmit={onSubmit}
      submitLabel={MODE_COPY[mode].submit}
      submitting={formState.isSubmitting}
      submitDisabled={!canEdit}
      maxWidth="xs"
    >
      <Stack spacing={2}>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={mode}
          onChange={(_, value: AdjustMode | null) => {
            if (!value) return;
            setMode(value);
            reset({ amount: value === 'adjust' ? String(item.quantity) : '', note: watch('note') });
          }}
          aria-label="Type of stock change"
        >
          {(Object.keys(MODE_COPY) as AdjustMode[]).map((key) => (
            <ToggleButton key={key} value={key}>
              {MODE_COPY[key].label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <FormNumberField control={control} name="amount" label={MODE_COPY[mode].field} unit={item.unit} required autoFocus />
        <FormTextField control={control} name="note" label="Note (optional)" placeholder="e.g. Used for dinner" />
        <Typography variant="body2" color={valid && next < 0 ? 'error' : 'text.secondary'} aria-live="polite">
          {valid
            ? next < 0
              ? `That’s more than the ${formatQuantity(item.quantity)} ${item.unit} in stock.`
              : `New quantity: ${formatQuantity(next)} ${item.unit}`
            : ' '}
        </Typography>
      </Stack>
    </FormDialog>
  );
}
