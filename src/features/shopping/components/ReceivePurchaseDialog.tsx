import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Divider, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useActiveHousehold,
  useCan,
  useCollection,
  useCommit,
  useCurrency,
  useCurrentUser,
  useMembers,
  useToday,
} from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import { FormMoneyField, FormNumberField, FormSelectField, FormSwitch } from '@/components/form/fields';
import type { ShoppingItem, ShoppingList } from '@/types/models';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import { allocateEvenly, formatMoney, minorToInput, parseMoneyInput } from '@/lib/money';
import { nowIso } from '@/lib/ids';
import { moneyString, numberString, toNumber } from '@/lib/validation';
import { formatQuantity, roundQuantity } from '@/features/inventory/logic';
import { useTaxonomy } from '@/features/inventory/hooks';
import { buildReceivePurchase, defaultExpenseCategory, normaliseName, type ReceiveInventoryTarget } from '../logic';

const schema = z
  .object({
    actualPrice: moneyString({ label: 'Price paid' }),
    quantity: numberString({ required: true, label: 'Quantity received', min: 0.001 }),
    updateInventory: z.boolean(),
    inventoryMode: z.enum(['existing', 'new']),
    inventoryItemId: z.string(),
    categoryId: z.string(),
    locationId: z.string(),
    recordExpense: z.boolean(),
    expenseCategory: z.string(),
    split: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.recordExpense && (value.actualPrice.trim() === '' || Number(value.actualPrice.replace(/,/g, '')) <= 0)) {
      ctx.addIssue({ code: 'custom', path: ['actualPrice'], message: 'Enter the price paid to record an expense' });
    }
    if (value.updateInventory && value.inventoryMode === 'existing' && !value.inventoryItemId) {
      ctx.addIssue({ code: 'custom', path: ['inventoryItemId'], message: 'Choose the inventory item to restock' });
    }
    if (value.updateInventory && value.inventoryMode === 'new') {
      if (!value.categoryId) ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Choose a category' });
      if (!value.locationId) ctx.addIssue({ code: 'custom', path: ['locationId'], message: 'Choose where it’s stored' });
    }
    if (value.recordExpense && !value.expenseCategory) {
      ctx.addIssue({ code: 'custom', path: ['expenseCategory'], message: 'Choose an expense category' });
    }
  });
type FormValues = z.infer<typeof schema>;

interface ReceivePurchaseDialogProps {
  open: boolean;
  onClose: () => void;
  list: ShoppingList;
  /** One item, or several to step through ("Record all purchases"). */
  items: ShoppingItem[];
}

/**
 * Records bought items into inventory and expenses. Every change is listed before confirming,
 * and each item is applied atomically and at most once.
 */
export function ReceivePurchaseDialog({ open, onClose, list, items }: ReceivePurchaseDialogProps) {
  const [index, setIndex] = useState(0);
  const queue = items;
  const item = queue[index];

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const advance = () => {
    if (index + 1 < queue.length) setIndex(index + 1);
    else onClose();
  };

  if (!item) return null;
  return (
    <ReceiveOne
      key={item.id}
      open={open}
      onClose={onClose}
      onDone={advance}
      list={list}
      item={item}
      position={queue.length > 1 ? { index, total: queue.length } : undefined}
    />
  );
}

function ReceiveOne({
  open,
  onClose,
  onDone,
  list,
  item,
  position,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  list: ShoppingList;
  item: ShoppingItem;
  position?: { index: number; total: number };
}) {
  const household = useActiveHousehold();
  const user = useCurrentUser();
  const currency = useCurrency();
  const today = useToday();
  const canEdit = useCan('edit');
  const commit = useCommit();
  const members = useMembers();
  const inventory = useCollection('inventoryItems');
  const { categories, locations, categoryById } = useTaxonomy();
  const inventoryEnabled = household?.enabledModules.includes('inventory') ?? true;
  const financeEnabled = household?.enabledModules.includes('finance') ?? true;

  const matched = useMemo(
    () =>
      (item.inventoryItemId ? inventory.find((entry) => entry.id === item.inventoryItemId) : undefined) ??
      inventory.find((entry) => !entry.archived && normaliseName(entry.name) === normaliseName(item.name)),
    [inventory, item],
  );
  const splitMembers = members.filter((member) => member.role !== 'viewer');
  const expenseCategories = [...EXPENSE_CATEGORIES, ...(household?.customExpenseCategories ?? [])];
  const categoryName = categoryById.get(matched?.categoryId ?? item.categoryId ?? '')?.name;

  const { control, handleSubmit, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      actualPrice: minorToInput(item.actualPriceMinor ?? item.estimatedPriceMinor, currency),
      quantity: String(item.quantity),
      updateInventory: inventoryEnabled,
      inventoryMode: matched ? 'existing' : 'new',
      inventoryItemId: matched?.id ?? '',
      categoryId: item.categoryId ?? categories[0]?.id ?? '',
      locationId: locations.find((location) => location.name === 'Pantry')?.id ?? locations[0]?.id ?? '',
      recordExpense: financeEnabled,
      expenseCategory: defaultExpenseCategory(categoryName),
      split: false,
    },
  });

  const values = watch();
  const priceMinor = values.actualPrice.trim() ? parseMoneyInput(values.actualPrice, currency) : null;
  const quantity = Number(values.quantity);
  const target = values.inventoryMode === 'existing' ? inventory.find((entry) => entry.id === values.inventoryItemId) : undefined;
  const unitMismatch = values.updateInventory && target && target.unit !== item.unit;

  const summary: string[] = [`Mark “${item.name}” as bought and recorded on ${list.name}`];
  if (values.updateInventory && Number.isFinite(quantity) && quantity > 0) {
    if (values.inventoryMode === 'existing' && target) {
      summary.push(`Inventory: ${target.name} ${formatQuantity(target.quantity)} → ${formatQuantity(roundQuantity(target.quantity + quantity))} ${target.unit}`);
    } else if (values.inventoryMode === 'new') {
      summary.push(`Inventory: add new item “${item.name}” with ${formatQuantity(quantity)} ${item.unit}`);
    }
  } else {
    summary.push('Inventory: no change');
  }
  if (values.recordExpense && priceMinor) {
    let text = `Expense: ${formatMoney(priceMinor, currency)} · ${values.expenseCategory} · paid by you`;
    if (values.split && splitMembers.length > 1) {
      const shares = allocateEvenly(priceMinor, splitMembers.length);
      text += ` · split equally (${shares.map((share) => formatMoney(share, currency)).join(' / ')})`;
    }
    summary.push(text);
  } else {
    summary.push('Expense: not recorded');
  }

  const onSubmit = handleSubmit(async (form) => {
    if (!user) return;
    const price = form.actualPrice.trim() ? (parseMoneyInput(form.actualPrice, currency) ?? undefined) : undefined;
    let inventoryTarget: ReceiveInventoryTarget = { mode: 'none' };
    if (form.updateInventory) {
      const existing = inventory.find((entry) => entry.id === form.inventoryItemId);
      inventoryTarget =
        form.inventoryMode === 'existing' && existing
          ? { mode: 'existing', item: existing }
          : { mode: 'new', name: item.name, categoryId: form.categoryId, locationId: form.locationId, unit: item.unit, minQuantity: 0 };
    }
    const result = buildReceivePurchase({
      shoppingItem: item,
      list,
      actorId: user.id,
      now: nowIso(),
      today,
      actualPriceMinor: price,
      quantity: toNumber(form.quantity),
      inventory: inventoryTarget,
      expense: form.recordExpense
        ? {
            category: form.expenseCategory,
            payerId: user.id,
            splitWith: form.split ? splitMembers.map((member) => member.userId) : undefined,
          }
        : undefined,
    });
    const ok = await commit(result.changes, {
      idempotencyKey: result.idempotencyKey,
      success: `Recorded “${item.name}”`,
      activity: { entity: 'shopping', entityId: list.id, message: `Recorded the purchase of “${item.name}” from ${list.name}` },
    });
    if (ok) onDone();
  });

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={position ? `Record purchase ${position.index + 1} of ${position.total}` : 'Record purchase'}
      description={`${item.name} · ${formatQuantity(item.quantity)} ${item.unit}`}
      onSubmit={onSubmit}
      submitLabel="Confirm & record"
      submitting={formState.isSubmitting}
      submitDisabled={!canEdit}
      secondaryActions={
        position && position.index + 1 < position.total ? (
          <Button color="inherit" onClick={onDone} disabled={formState.isSubmitting}>
            Skip this item
          </Button>
        ) : undefined
      }
    >
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormMoneyField control={control} name="actualPrice" label="Price paid (total)" autoFocus />
          <FormNumberField
            control={control}
            name="quantity"
            label="Quantity received"
            unit={values.updateInventory && target ? target.unit : item.unit}
            required
          />
        </Stack>

        {inventoryEnabled && (
          <Box>
            <FormSwitch control={control} name="updateInventory" label="Update inventory" />
            {values.updateInventory && (
              <Stack spacing={1.5} sx={{ mt: 1, pl: { sm: 1 } }}>
                <Controller
                  control={control}
                  name="inventoryMode"
                  render={({ field }) => (
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={field.value}
                      onChange={(_, value: FormValues['inventoryMode'] | null) => value && field.onChange(value)}
                      aria-label="Inventory destination"
                    >
                      <ToggleButton value="existing" disabled={inventory.length === 0}>
                        Restock an item
                      </ToggleButton>
                      <ToggleButton value="new">Add as new item</ToggleButton>
                    </ToggleButtonGroup>
                  )}
                />
                {values.inventoryMode === 'existing' ? (
                  <FormSelectField
                    control={control}
                    name="inventoryItemId"
                    label="Inventory item"
                    options={inventory
                      .filter((entry) => !entry.archived || entry.id === matched?.id)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((entry) => ({ value: entry.id, label: `${entry.name} (${formatQuantity(entry.quantity)} ${entry.unit})` }))}
                  />
                ) : (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <FormSelectField
                      control={control}
                      name="categoryId"
                      label="Category"
                      options={categories.map((category) => ({ value: category.id, label: category.name }))}
                    />
                    <FormSelectField
                      control={control}
                      name="locationId"
                      label="Store in"
                      options={locations.map((location) => ({ value: location.id, label: location.name }))}
                    />
                  </Stack>
                )}
                {unitMismatch && target && (
                  <Alert severity="warning">
                    The list uses “{item.unit}” but {target.name} is tracked in “{target.unit}”. Enter the quantity in {target.unit}.
                  </Alert>
                )}
              </Stack>
            )}
          </Box>
        )}

        {financeEnabled && (
          <Box>
            <FormSwitch control={control} name="recordExpense" label="Record as a household expense" />
            {values.recordExpense && (
              <Stack spacing={1} sx={{ mt: 1, pl: { sm: 1 } }}>
                <FormSelectField
                  control={control}
                  name="expenseCategory"
                  label="Expense category"
                  options={expenseCategories.map((category) => ({ value: category, label: category }))}
                />
                {splitMembers.length > 1 && (
                  <FormSwitch
                    control={control}
                    name="split"
                    label={`Split equally between ${splitMembers.length} members`}
                    helperText="You paid; others will owe you their share."
                  />
                )}
              </Stack>
            )}
          </Box>
        )}

        <Divider />
        <Box
          sx={(theme) => ({ p: 1.5, borderRadius: 2, backgroundColor: theme.tokens.surfaceMuted })}
          aria-live="polite"
        >
          <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
            This will:
          </Typography>
          <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.5 }}>
            {summary.map((line) => (
              <Typography key={line} component="li" variant="body2">
                {line}
              </Typography>
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            Recorded once only — repeating this action won’t duplicate stock or expenses.
          </Typography>
        </Box>
      </Stack>
    </FormDialog>
  );
}
