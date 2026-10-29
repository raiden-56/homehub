import { useMemo } from 'react';
import { Box, Button, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Plus, Trash2 } from 'lucide-react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useActiveHousehold, useCan, useCommit, useCurrency } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import { FormMoneyField, FormNumberField } from '@/components/form/fields';
import { formatMoney, minorToInput, parseMoneyInput } from '@/lib/money';
import { moneyString, numberString } from '@/lib/validation';
import { nowIso } from '@/lib/ids';
import type { Budget } from '@/types/models';
import { useExpenseCategories } from '../hooks';

interface BudgetDialogProps {
  open: boolean;
  onClose: () => void;
  budget?: Budget;
}

/** Edits the household's monthly budget: overall amount, category limits and warning threshold. */
export function BudgetDialog({ open, onClose, budget }: BudgetDialogProps) {
  const household = useActiveHousehold();
  const currency = useCurrency();
  const commit = useCommit();
  const canEdit = useCan('edit');
  const categories = useExpenseCategories();

  const schema = useMemo(
    () =>
      z
        .object({
          overall: moneyString({ currency }),
          warningPercent: numberString({ required: true, label: 'Warning threshold', min: 1, max: 100, integer: true }),
          categories: z.array(z.object({ category: z.string().min(1, 'Choose a category'), limit: moneyString({ required: true, currency, label: 'Limit' }) })),
        })
        .superRefine((values, ctx) => {
          const seen = new Set<string>();
          values.categories.forEach((entry, index) => {
            if (seen.has(entry.category)) {
              ctx.addIssue({ code: 'custom', path: ['categories', index, 'category'], message: 'This category already has a limit' });
            }
            seen.add(entry.category);
          });
          if (values.overall.trim() === '' && values.categories.length === 0) {
            ctx.addIssue({ code: 'custom', path: ['overall'], message: 'Set an overall budget or at least one category limit' });
          }
        }),
    [currency],
  );
  type Values = z.infer<typeof schema>;

  const { control, handleSubmit, formState, watch } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      overall: minorToInput(budget?.overallMinor, currency),
      warningPercent: String(budget?.warningPercent ?? 80),
      categories: (budget?.categories ?? []).map((entry) => ({ category: entry.category, limit: minorToInput(entry.limitMinor, currency) })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'categories' });
  const rows = watch('categories');
  const categoryTotal = rows.reduce((sum, row) => sum + (parseMoneyInput(row.limit, currency) ?? 0), 0);

  const onSubmit = handleSubmit(async (values) => {
    if (!household) return;
    const now = nowIso();
    const next: Budget = {
      id: household.id,
      householdId: household.id,
      overallMinor: values.overall.trim() === '' ? undefined : parseMoneyInput(values.overall, currency)!,
      warningPercent: Number(values.warningPercent),
      categories: values.categories.map((entry) => ({ category: entry.category, limitMinor: parseMoneyInput(entry.limit, currency)! })),
      createdAt: budget?.createdAt ?? now,
      updatedAt: now,
    };
    const ok = await commit(
      { put: { budgets: [next] } },
      {
        activity: { entity: 'budget', entityId: next.id, message: budget ? 'Updated the monthly budget' : 'Set a monthly budget' },
        success: 'Budget saved',
        undo: budget ? { put: { budgets: [budget] } } : { remove: { budgets: [next.id] } },
      },
    );
    if (ok) onClose();
  });

  const unused = categories.filter((category) => !rows.some((row) => row.category === category));

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={budget ? 'Edit monthly budget' : 'Set a monthly budget'}
      description="Budgets apply to each calendar month and are compared with recorded expenses."
      onSubmit={onSubmit}
      submitLabel="Save budget"
      submitting={formState.isSubmitting}
      submitDisabled={!canEdit}
    >
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormMoneyField
            control={control}
            name="overall"
            label="Overall monthly budget"
            helperText="Leave blank to use the total of category limits."
          />
          <FormNumberField control={control} name="warningPercent" label="Warn at" unit="%" step="1" required sx={{ maxWidth: { sm: 140 } }} />
        </Stack>
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Category limits
          </Typography>
          <Stack spacing={1.5}>
            {fields.map((field, index) => (
              <Stack key={field.id} direction="row" spacing={1} alignItems="flex-start">
                <Controller
                  control={control}
                  name={`categories.${index}.category`}
                  render={({ field: categoryField, fieldState }) => (
                    <TextField
                      select
                      label="Category"
                      {...categoryField}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    >
                      {[categoryField.value, ...unused].filter(Boolean).map((category) => (
                        <MenuItem key={category} value={category}>
                          {category}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
                <FormMoneyField control={control} name={`categories.${index}.limit`} label="Limit" />
                <IconButton aria-label={`Remove ${rows[index]?.category || 'category'} limit`} onClick={() => remove(index)} sx={{ mt: 0.25 }}>
                  <Trash2 size={18} />
                </IconButton>
              </Stack>
            ))}
            <Button
              startIcon={<Plus size={16} />}
              onClick={() => append({ category: unused[0] ?? '', limit: '' })}
              disabled={unused.length === 0}
              sx={{ alignSelf: 'flex-start' }}
            >
              Add category limit
            </Button>
            {fields.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                Category limits total {formatMoney(categoryTotal, currency)}.
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>
    </FormDialog>
  );
}
