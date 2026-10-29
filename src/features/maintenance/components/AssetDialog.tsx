import { useEffect } from 'react';
import { Stack } from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useActiveHousehold, useCan, useCommit, useCurrency } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import { FormDateField, FormMoneyField, FormSelectField, FormTextField } from '@/components/form/fields';
import { ASSET_CATEGORIES } from '@/lib/constants';
import { minorToInput, parseMoneyInput } from '@/lib/money';
import { newId, nowIso } from '@/lib/ids';
import { blankToUndefined, dateString, moneyString, optionalText, requiredText } from '@/lib/validation';
import type { Asset } from '@/types/models';

const schema = z
  .object({
    name: requiredText('Asset name', 120),
    category: z.string().min(1, 'Choose a category'),
    manufacturer: optionalText(80),
    model: optionalText(80),
    serialNumber: optionalText(80),
    purchaseDate: dateString(),
    purchasePrice: moneyString({ label: 'Purchase price' }),
    warrantyExpiry: dateString(),
    location: optionalText(80),
    notes: optionalText(1000),
  })
  .refine((value) => !value.purchaseDate || !value.warrantyExpiry || value.warrantyExpiry >= value.purchaseDate, {
    path: ['warrantyExpiry'],
    message: 'Warranty can’t end before the purchase date',
  });
type FormValues = z.infer<typeof schema>;

export function AssetDialog({ open, onClose, asset }: { open: boolean; onClose: () => void; asset?: Asset }) {
  const household = useActiveHousehold();
  const currency = useCurrency();
  const canEdit = useCan('edit');
  const commit = useCommit();

  const defaults = (): FormValues => ({
    name: asset?.name ?? '',
    category: asset?.category ?? ASSET_CATEGORIES[0]!,
    manufacturer: asset?.manufacturer ?? '',
    model: asset?.model ?? '',
    serialNumber: asset?.serialNumber ?? '',
    purchaseDate: asset?.purchaseDate ?? '',
    purchasePrice: minorToInput(asset?.purchasePriceMinor, currency),
    warrantyExpiry: asset?.warrantyExpiry ?? '',
    location: asset?.location ?? '',
    notes: asset?.notes ?? '',
  });
  const { control, handleSubmit, reset, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() });

  useEffect(() => {
    if (open) reset(defaults());
    // Reset only when opening or switching record.
  }, [open, asset?.id]);

  const categories = asset && !ASSET_CATEGORIES.includes(asset.category) ? [...ASSET_CATEGORIES, asset.category] : ASSET_CATEGORIES;

  const save = handleSubmit(async (values) => {
    if (!household) return;
    const now = nowIso();
    const id = asset?.id ?? newId();
    const record: Asset = {
      ...(asset ?? { archived: false, createdAt: now }),
      id,
      householdId: household.id,
      name: values.name.trim(),
      category: values.category,
      manufacturer: blankToUndefined(values.manufacturer),
      model: blankToUndefined(values.model),
      serialNumber: blankToUndefined(values.serialNumber),
      purchaseDate: values.purchaseDate || undefined,
      purchasePriceMinor: values.purchasePrice.trim() ? (parseMoneyInput(values.purchasePrice, currency) ?? undefined) : undefined,
      warrantyExpiry: values.warrantyExpiry || undefined,
      location: blankToUndefined(values.location),
      notes: blankToUndefined(values.notes),
      updatedAt: now,
    };
    const ok = await commit(
      { put: { assets: [record] } },
      {
        activity: { entity: 'asset', entityId: id, message: asset ? `Updated asset “${record.name}”` : `Added asset “${record.name}”` },
        success: asset ? 'Asset updated' : 'Asset added',
        undo: asset ? { put: { assets: [asset] } } : { remove: { assets: [id] } },
      },
    );
    if (ok) onClose();
  });

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={asset ? 'Edit asset' : 'Add asset'}
      submitLabel={asset ? 'Save changes' : 'Add asset'}
      onSubmit={save}
      submitting={formState.isSubmitting}
      submitDisabled={!canEdit}
    >
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormTextField control={control} name="name" label="Asset name" required placeholder="e.g. Bedroom split AC" autoFocus={!asset} />
          <FormSelectField control={control} name="category" label="Category" required options={categories.map((value) => ({ value, label: value }))} />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormTextField control={control} name="manufacturer" label="Manufacturer" />
          <FormTextField control={control} name="model" label="Model" />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormTextField control={control} name="serialNumber" label="Serial number" />
          <FormTextField control={control} name="location" label="Location" placeholder="e.g. Kitchen" />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormDateField control={control} name="purchaseDate" label="Purchase date" />
          <FormMoneyField control={control} name="purchasePrice" label="Purchase price" />
        </Stack>
        <FormDateField control={control} name="warrantyExpiry" label="Warranty expiry" helperText="Leave blank if unknown" />
        <FormTextField control={control} name="notes" label="Notes" multiline minRows={2} />
      </Stack>
    </FormDialog>
  );
}
