import { useEffect, useMemo } from 'react';
import { Box, Stack } from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useActiveHousehold, useCan, useCollection, useCommit, useCurrency, useCurrentUser } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import { FormMoneyField, FormNumberField, FormSelectField, FormTextField } from '@/components/form/fields';
import type { ShoppingItem, ShoppingList } from '@/types/models';
import { UNITS } from '@/lib/constants';
import { minorToInput, parseMoneyInput } from '@/lib/money';
import { newId, nowIso } from '@/lib/ids';
import { blankToUndefined, moneyString, numberString, optionalText, requiredText, toNumber } from '@/lib/validation';
import { roundQuantity } from '@/features/inventory/logic';
import { useTaxonomy } from '@/features/inventory/hooks';
import { newListRecord, touchList } from '../hooks';
import { defaultList, findDuplicate, nextSortOrder } from '../logic';

const NEW_LIST = '__new__';

const schema = z.object({
  listId: z.string().min(1, 'Choose a list'),
  name: requiredText('Item name', 80),
  quantity: numberString({ required: true, label: 'Quantity', min: 0.001 }),
  unit: requiredText('Unit', 20),
  categoryId: z.string(),
  inventoryItemId: z.string(),
  estimatedPrice: moneyString({ label: 'Estimated price' }),
  actualPrice: moneyString({ label: 'Actual price' }),
  priority: z.enum(['low', 'normal', 'high']),
  notes: optionalText(500),
});
type FormValues = z.infer<typeof schema>;

interface ShoppingItemDialogProps {
  open: boolean;
  onClose: () => void;
  listId?: string;
  item?: ShoppingItem;
}

/** Add or edit a shopping item. Without a list, the user chooses one (or a new list is created). */
export function ShoppingItemDialog({ open, onClose, listId, item }: ShoppingItemDialogProps) {
  const household = useActiveHousehold();
  const user = useCurrentUser();
  const currency = useCurrency();
  const canEdit = useCan('edit');
  const commit = useCommit();
  const lists = useCollection('shoppingLists');
  const items = useCollection('shoppingItems');
  const inventory = useCollection('inventoryItems');
  const { categories } = useTaxonomy();

  const activeLists = useMemo(() => lists.filter((list) => !list.archived).sort((a, b) => a.name.localeCompare(b.name)), [lists]);
  const fallbackList = defaultList(lists);
  const defaults = useMemo<FormValues>(
    () => ({
      listId: item?.listId ?? listId ?? fallbackList?.id ?? NEW_LIST,
      name: item?.name ?? '',
      quantity: item ? String(item.quantity) : '1',
      unit: item?.unit ?? 'pcs',
      categoryId: item?.categoryId ?? '',
      inventoryItemId: item?.inventoryItemId ?? '',
      estimatedPrice: minorToInput(item?.estimatedPriceMinor, currency),
      actualPrice: minorToInput(item?.actualPriceMinor, currency),
      priority: item?.priority ?? 'normal',
      notes: item?.notes ?? '',
    }),
    [item, listId, fallbackList?.id, currency],
  );

  const { control, handleSubmit, reset, setError, setValue, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
  }, [open, defaults, reset]);

  const inventoryItemId = watch('inventoryItemId');
  useEffect(() => {
    // Linking an inventory item fills in its unit and category when they're still defaults.
    if (!inventoryItemId || item) return;
    const linked = inventory.find((entry) => entry.id === inventoryItemId);
    if (!linked) return;
    setValue('unit', linked.unit);
    setValue('categoryId', linked.categoryId);
  }, [inventoryItemId, inventory, item, setValue]);

  const unitOptions = useMemo(() => {
    const units = new Set(UNITS);
    if (item?.unit) units.add(item.unit);
    return [...units].map((unit) => ({ value: unit, label: unit }));
  }, [item?.unit]);

  const onSubmit = handleSubmit(async (values) => {
    if (!household || !user) return;
    const now = nowIso();
    let list: ShoppingList | undefined = lists.find((entry) => entry.id === values.listId);
    const creatingList = values.listId === NEW_LIST || !list;
    if (creatingList) list = newListRecord(household.id, 'Shopping list', user.id, now);
    const targetList = list!;

    const fields = {
      name: values.name.trim(),
      quantity: roundQuantity(toNumber(values.quantity)),
      unit: values.unit,
      categoryId: values.categoryId || undefined,
      inventoryItemId: values.inventoryItemId || undefined,
      estimatedPriceMinor: values.estimatedPrice.trim() ? (parseMoneyInput(values.estimatedPrice, currency) ?? undefined) : undefined,
      actualPriceMinor: values.actualPrice.trim() ? (parseMoneyInput(values.actualPrice, currency) ?? undefined) : undefined,
      priority: values.priority,
      notes: blankToUndefined(values.notes),
    };

    const duplicate = findDuplicate(
      items.filter((entry) => entry.id !== item?.id),
      targetList.id,
      { name: fields.name, inventoryItemId: fields.inventoryItemId },
    );
    if (duplicate && !item?.purchased) {
      setError('name', { message: `“${duplicate.name}” is already on ${targetList.name} — edit that entry instead.` });
      return;
    }

    if (item) {
      const movedList = item.listId !== targetList.id;
      const updated: ShoppingItem = {
        ...item,
        ...fields,
        listId: targetList.id,
        sortOrder: movedList ? nextSortOrder(items, targetList.id) : item.sortOrder,
        updatedAt: now,
      };
      const ok = await commit(
        { put: { shoppingItems: [updated], shoppingLists: [touchList(targetList, now)] } },
        {
          success: `Saved “${updated.name}”`,
          activity: { entity: 'shopping', entityId: targetList.id, message: `Edited “${updated.name}” on ${targetList.name}` },
        },
      );
      if (ok) onClose();
      return;
    }

    const created: ShoppingItem = {
      id: newId(),
      householdId: household.id,
      listId: targetList.id,
      ...fields,
      purchased: false,
      addedBy: user.id,
      sortOrder: nextSortOrder(items, targetList.id),
      createdAt: now,
      updatedAt: now,
    };
    const ok = await commit(
      { put: { shoppingItems: [created], shoppingLists: [touchList(targetList, now)] } },
      {
        success: `Added “${created.name}” to ${targetList.name}`,
        undo: creatingList
          ? { remove: { shoppingItems: [created.id], shoppingLists: [targetList.id] } }
          : { remove: { shoppingItems: [created.id] } },
        activity: { entity: 'shopping', entityId: targetList.id, message: `Added “${created.name}” to ${targetList.name}` },
      },
    );
    if (ok) onClose();
  });

  const listOptions = [
    ...activeLists.map((list) => ({ value: list.id, label: list.name })),
    ...(listId || item ? [] : [{ value: NEW_LIST, label: activeLists.length ? '+ New list “Shopping list”' : 'New list “Shopping list”' }]),
  ];
  const inventoryOptions = inventory
    .filter((entry) => !entry.archived || entry.id === item?.inventoryItemId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => ({ value: entry.id, label: `${entry.name} (${entry.quantity} ${entry.unit})` }));

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={item ? 'Edit shopping item' : 'Add shopping item'}
      onSubmit={onSubmit}
      submitLabel={item ? 'Save changes' : 'Add to list'}
      submitting={formState.isSubmitting}
      submitDisabled={!canEdit}
    >
      <Stack spacing={2}>
        {(!listId || item) && <FormSelectField control={control} name="listId" label="List" required options={listOptions} />}
        <FormTextField control={control} name="name" label="Item name" required autoFocus placeholder="e.g. Milk" />
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' } }}>
          <FormNumberField control={control} name="quantity" label="Quantity" required />
          <FormSelectField control={control} name="unit" label="Unit" required options={unitOptions} />
          <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
            <FormSelectField
              control={control}
              name="priority"
              label="Priority"
              options={[
                { value: 'high', label: 'High' },
                { value: 'normal', label: 'Normal' },
                { value: 'low', label: 'Low' },
              ]}
            />
          </Box>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormSelectField
            control={control}
            name="categoryId"
            label="Category"
            emptyLabel="No category"
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
          />
          <FormSelectField
            control={control}
            name="inventoryItemId"
            label="Restocks inventory item"
            emptyLabel="Not linked"
            options={inventoryOptions}
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormMoneyField control={control} name="estimatedPrice" label="Estimated price (total)" helperText="For this line, not per unit" />
          {item?.purchased && <FormMoneyField control={control} name="actualPrice" label="Actual price paid (total)" />}
        </Stack>
        <FormTextField control={control} name="notes" label="Notes" multiline minRows={2} placeholder="Brand, size, store…" />
      </Stack>
    </FormDialog>
  );
}
