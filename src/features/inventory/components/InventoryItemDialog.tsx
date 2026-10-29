import { useEffect, useMemo } from 'react';
import { Box, Stack } from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useActiveHousehold, useCan, useCommit, useCurrency, useCurrentUser } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import {
  FormDateField,
  FormMoneyField,
  FormNumberField,
  FormSelectField,
  FormTextField,
} from '@/components/form/fields';
import type { InventoryItem, InventoryMovement } from '@/types/models';
import { UNITS } from '@/lib/constants';
import { minorToInput, parseMoneyInput } from '@/lib/money';
import { newId, nowIso } from '@/lib/ids';
import {
  blankToUndefined,
  dateString,
  moneyString,
  numberString,
  optionalText,
  requiredText,
  toNumber,
} from '@/lib/validation';
import { buildQuantityChange, useTaxonomy } from '../hooks';
import { roundQuantity } from '../logic';

const schema = z
  .object({
    name: requiredText('Name', 80),
    categoryId: z.string().min(1, 'Choose a category'),
    locationId: z.string().min(1, 'Choose a storage location'),
    quantity: numberString({ required: true, label: 'Quantity', min: 0 }),
    unit: requiredText('Unit', 20),
    minQuantity: numberString({ label: 'Minimum stock', min: 0 }),
    purchasePrice: moneyString({ label: 'Purchase price' }),
    purchaseDate: dateString({ label: 'Purchase date' }),
    expiryDate: dateString({ label: 'Expiry date' }),
    barcode: optionalText(64),
    notes: optionalText(1000),
  })
  .refine((value) => !value.purchaseDate || !value.expiryDate || value.expiryDate >= value.purchaseDate, {
    path: ['expiryDate'],
    message: 'Expiry date can’t be before the purchase date',
  });

type FormValues = z.infer<typeof schema>;

interface InventoryItemDialogProps {
  open: boolean;
  onClose: () => void;
  item?: InventoryItem;
}

/** Create or edit an inventory item. Quantity changes are recorded as stock movements. */
export function InventoryItemDialog({ open, onClose, item }: InventoryItemDialogProps) {
  const household = useActiveHousehold();
  const user = useCurrentUser();
  const currency = useCurrency();
  const canEdit = useCan('edit');
  const commit = useCommit();
  const { categories, locations } = useTaxonomy();

  const defaults = useMemo<FormValues>(
    () => ({
      name: item?.name ?? '',
      // New items start in "Miscellaneous" and the pantry so a quick add only needs a name.
      categoryId: item?.categoryId ?? (categories.find((entry) => entry.name === 'Miscellaneous') ?? categories[0])?.id ?? '',
      locationId: item?.locationId ?? (locations.find((entry) => entry.name === 'Pantry') ?? locations[0])?.id ?? '',
      quantity: item ? String(item.quantity) : '1',
      unit: item?.unit ?? 'pcs',
      minQuantity: item ? String(item.minQuantity) : '',
      purchasePrice: minorToInput(item?.purchasePriceMinor, currency),
      purchaseDate: item?.purchaseDate ?? '',
      expiryDate: item?.expiryDate ?? '',
      barcode: item?.barcode ?? '',
      notes: item?.notes ?? '',
    }),
    [item, currency, categories, locations],
  );

  const { control, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
  }, [open, defaults, reset]);

  const unitOptions = useMemo(() => {
    const units = new Set(UNITS);
    if (item?.unit) units.add(item.unit);
    return [...units].map((unit) => ({ value: unit, label: unit }));
  }, [item?.unit]);

  const onSubmit = handleSubmit(async (values) => {
    if (!household || !user) return;
    const now = nowIso();
    const quantity = roundQuantity(toNumber(values.quantity));
    const fields = {
      name: values.name.trim(),
      categoryId: values.categoryId,
      locationId: values.locationId,
      unit: values.unit.trim(),
      minQuantity: values.minQuantity.trim() === '' ? 0 : roundQuantity(toNumber(values.minQuantity)),
      purchasePriceMinor: values.purchasePrice.trim() === '' ? undefined : (parseMoneyInput(values.purchasePrice, currency) ?? undefined),
      purchaseDate: blankToUndefined(values.purchaseDate),
      expiryDate: blankToUndefined(values.expiryDate),
      barcode: blankToUndefined(values.barcode),
      notes: blankToUndefined(values.notes),
    };

    if (item) {
      const updated: InventoryItem = { ...item, ...fields, updatedAt: now };
      const movements: InventoryMovement[] = [];
      let saved = updated;
      if (quantity !== item.quantity) {
        const change = buildQuantityChange(updated, quantity, 'adjust', user.id, 'Edited item details');
        saved = change.item;
        movements.push(change.movement);
      }
      const ok = await commit(
        { put: { inventoryItems: [saved], inventoryMovements: movements } },
        {
          success: `Saved “${saved.name}”`,
          activity: { entity: 'inventory', entityId: item.id, message: `Updated “${saved.name}”` },
        },
      );
      if (ok) onClose();
      return;
    }

    const id = newId();
    const created: InventoryItem = {
      id,
      householdId: household.id,
      ...fields,
      quantity,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    const movement: InventoryMovement = {
      id: newId(),
      householdId: household.id,
      itemId: id,
      type: 'initial',
      delta: quantity,
      quantityAfter: quantity,
      note: 'Opening stock',
      actorId: user.id,
      occurredAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const ok = await commit(
      { put: { inventoryItems: [created], inventoryMovements: [movement] } },
      {
        success: `Added “${created.name}” to inventory`,
        activity: { entity: 'inventory', entityId: id, message: `Added “${created.name}” to inventory` },
      },
    );
    if (ok) onClose();
  });

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={item ? 'Edit inventory item' : 'Add inventory item'}
      description={item ? undefined : 'Track what you have, where it’s kept and when to restock.'}
      onSubmit={onSubmit}
      submitLabel={item ? 'Save changes' : 'Add item'}
      submitting={formState.isSubmitting}
      submitDisabled={!canEdit}
    >
      <Stack spacing={2}>
        <FormTextField control={control} name="name" label="Name" required autoFocus placeholder="e.g. Basmati rice" />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormSelectField
            control={control}
            name="categoryId"
            label="Category"
            required
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
          />
          <FormSelectField
            control={control}
            name="locationId"
            label="Storage location"
            required
            options={locations.map((location) => ({ value: location.id, label: location.name }))}
          />
        </Stack>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' } }}>
          <FormNumberField
            control={control}
            name="quantity"
            label="Quantity"
            required
            helperText={item ? 'Changes are logged as an adjustment' : undefined}
          />
          <FormSelectField control={control} name="unit" label="Unit" required options={unitOptions} />
          <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
            <FormNumberField
              control={control}
              name="minQuantity"
              label="Minimum stock"
              helperText="Flag as low below this"
            />
          </Box>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormMoneyField control={control} name="purchasePrice" label="Purchase price (optional)" />
          <FormDateField control={control} name="purchaseDate" label="Purchase date" />
          <FormDateField control={control} name="expiryDate" label="Expiry date" helperText="Leave blank if it doesn’t expire" />
        </Stack>
        <FormTextField control={control} name="barcode" label="Barcode (optional)" slotProps={{ htmlInput: { inputMode: 'numeric' } }} />
        <FormTextField control={control} name="notes" label="Notes" multiline minRows={2} />
      </Stack>
    </FormDialog>
  );
}
