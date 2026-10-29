import { useMemo, useState } from 'react';
import { Alert, Button, MenuItem, Stack, TextField } from '@mui/material';
import { Plus } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useActiveHousehold,
  useCan,
  useCommit,
  useCurrency,
  useCurrentUser,
  useMembers,
  useToday,
} from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import { FormDateField, FormMemberSelect, FormMoneyField, FormSelectField, FormTextField } from '@/components/form/fields';
import { PAYMENT_METHODS } from '@/lib/constants';
import { minorToInput, parseMoneyInput } from '@/lib/money';
import { blankToUndefined, dateString, moneyString, optionalText, requiredText } from '@/lib/validation';
import { newId, nowIso } from '@/lib/ids';
import type { Expense } from '@/types/models';
import { draftToSplit, emptySplitDraft, splitToDraft, type SplitDraft } from '../logic/splits';
import { useExpenseCategories } from '../hooks';
import { SplitEditor } from './SplitEditor';

interface ExpenseDialogProps {
  open: boolean;
  onClose: () => void;
  /** Existing expense to edit; omit to record a new one. */
  expense?: Expense;
}

const SOURCE_NOTES: Partial<Record<Expense['source'], string>> = {
  bill: 'This expense was recorded when a bill was marked as paid.',
  shopping: 'This expense was recorded from a shopping purchase.',
  maintenance: 'This expense was recorded when maintenance was completed.',
};

export function ExpenseDialog({ open, onClose, expense }: ExpenseDialogProps) {
  const household = useActiveHousehold();
  const user = useCurrentUser();
  const members = useMembers();
  const currency = useCurrency();
  const today = useToday();
  const commit = useCommit();
  const canEdit = useCan('edit');
  const categories = useExpenseCategories();
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const memberIds = members.map((member) => member.userId);

  const schema = useMemo(
    () =>
      z
        .object({
          description: requiredText('Description', 120),
          amount: moneyString({ required: true, currency }),
          date: dateString({ required: true }),
          category: z.string().min(1, 'Choose a category'),
          payerId: z.string().min(1, 'Choose who paid'),
          paymentMethod: z.string(),
          notes: optionalText(500),
          split: z.custom<SplitDraft>(),
        })
        .superRefine((values, ctx) => {
          const result = draftToSplit(values.split, parseMoneyInput(values.amount, currency), currency);
          if (result.error) ctx.addIssue({ code: 'custom', path: ['split'], message: result.error });
        }),
    [currency],
  );
  type Values = z.infer<typeof schema>;

  const { control, handleSubmit, formState, setValue } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: expense?.description ?? '',
      amount: minorToInput(expense?.amountMinor, currency),
      date: expense?.date ?? today,
      category: expense?.category ?? 'Groceries',
      payerId: expense?.payerId ?? user?.id ?? '',
      paymentMethod: expense?.paymentMethod ?? '',
      notes: expense?.notes ?? '',
      split: expense?.split
        ? splitToDraft(expense.split, memberIds, (minor) => minorToInput(minor, currency))
        : emptySplitDraft(memberIds),
    },
  });
  const amount = useWatch({ control, name: 'amount' });

  const addCategory = async () => {
    if (!household || newCategory === null) return;
    const name = newCategory.trim();
    if (!name || name.length > 40) {
      setCategoryError('Use 1–40 characters');
      return;
    }
    if (categories.some((category) => category.toLowerCase() === name.toLowerCase())) {
      setValue('category', categories.find((category) => category.toLowerCase() === name.toLowerCase())!);
      setNewCategory(null);
      return;
    }
    const ok = await commit(
      {
        put: {
          households: [
            { ...household, customExpenseCategories: [...household.customExpenseCategories, name], updatedAt: nowIso() },
          ],
        },
      },
      { activity: { entity: 'household', message: `Added the expense category “${name}”` }, success: `Category “${name}” added` },
    );
    if (ok) {
      setValue('category', name, { shouldValidate: true });
      setNewCategory(null);
      setCategoryError(null);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!household) return;
    const now = nowIso();
    const amountMinor = parseMoneyInput(values.amount, currency)!;
    const record: Expense = {
      id: expense?.id ?? newId(),
      householdId: household.id,
      description: values.description.trim(),
      amountMinor,
      date: values.date,
      category: values.category,
      payerId: values.payerId,
      paymentMethod: values.paymentMethod || undefined,
      notes: blankToUndefined(values.notes),
      receiptDocumentId: expense?.receiptDocumentId,
      source: expense?.source ?? 'manual',
      sourceId: expense?.sourceId,
      split: draftToSplit(values.split, amountMinor, currency).split,
      createdAt: expense?.createdAt ?? now,
      updatedAt: now,
    };
    const ok = await commit(
      { put: { expenses: [record] } },
      {
        activity: {
          entity: 'expense',
          entityId: record.id,
          message: expense ? `Updated the expense “${record.description}”` : `Recorded the expense “${record.description}”`,
        },
        success: expense ? 'Expense updated' : 'Expense recorded',
        undo: expense ? { put: { expenses: [expense] } } : { remove: { expenses: [record.id] } },
      },
    );
    if (ok) onClose();
  });

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={expense ? 'Edit expense' : 'Record expense'}
      description={expense ? undefined : 'Money the household has actually spent.'}
      onSubmit={onSubmit}
      submitLabel={expense ? 'Save changes' : 'Save expense'}
      submitting={formState.isSubmitting}
      submitDisabled={!canEdit}
    >
      <Stack spacing={2}>
        {expense && SOURCE_NOTES[expense.source] && <Alert severity="info">{SOURCE_NOTES[expense.source]}</Alert>}
        <FormTextField control={control} name="description" label="Description" required autoFocus={!expense} placeholder="e.g. Weekly groceries" />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormMoneyField control={control} name="amount" label="Amount" required />
          <FormDateField control={control} name="date" label="Date" required />
        </Stack>
        <Stack spacing={1}>
          <FormSelectField
            control={control}
            name="category"
            label="Category"
            options={categories.map((category) => ({ value: category, label: category }))}
          />
          {newCategory === null ? (
            <Button size="small" startIcon={<Plus size={14} />} onClick={() => setNewCategory('')} sx={{ alignSelf: 'flex-start' }} disabled={!canEdit}>
              Add a custom category
            </Button>
          ) : (
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <TextField
                label="New category"
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                error={!!categoryError}
                helperText={categoryError ?? undefined}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void addCategory();
                  }
                }}
              />
              <Button variant="outlined" onClick={addCategory} sx={{ flexShrink: 0 }}>
                Add
              </Button>
              <Button color="inherit" onClick={() => setNewCategory(null)} sx={{ flexShrink: 0 }}>
                Cancel
              </Button>
            </Stack>
          )}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormMemberSelect control={control} name="payerId" label="Paid by" emptyLabel={null} includeViewers />
          <FormTextField control={control} name="paymentMethod" label="Payment method (optional)" select>
            <MenuItem value="">
              <em>Not specified</em>
            </MenuItem>
            {PAYMENT_METHODS.map((method) => (
              <MenuItem key={method} value={method}>
                {method}
              </MenuItem>
            ))}
          </FormTextField>
        </Stack>
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
        <FormTextField control={control} name="notes" label="Notes" multiline minRows={2} />
      </Stack>
    </FormDialog>
  );
}
