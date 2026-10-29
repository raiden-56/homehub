import { useMemo } from 'react';
import { Autocomplete, Stack, TextField } from '@mui/material';
import { Controller, type Control } from 'react-hook-form';
import { z } from 'zod';
import { useAppSelector, useToday } from '@/app/hooks';
import { FormDateField, FormSelectField, FormTextField } from '@/components/form/fields';
import { DOCUMENT_CATEGORIES } from '@/lib/constants';
import { dateString, optionalText, requiredText } from '@/lib/validation';
import { LINK_TYPE_LABELS, linkTargets, sameLink, type LinkTarget } from '../logic';

export const documentMetadataSchema = z.object({
  title: requiredText('Title', 120),
  category: z.string().min(1, 'Choose a category'),
  notes: optionalText(1000),
  expiryDate: dateString(),
  links: z.array(z.object({ type: z.enum(['asset', 'bill', 'expense', 'maintenance']), id: z.string() })),
});

export type DocumentMetadataValues = z.infer<typeof documentMetadataSchema>;

/** Title, category, notes, expiry and linked records — shared by upload and edit dialogs. */
export function DocumentMetadataFields({ control }: { control: Control<DocumentMetadataValues> }) {
  const data = useAppSelector((state) => state.data);
  const today = useToday();
  const targets = useMemo(() => linkTargets(data, today), [data, today]);

  return (
    <Stack spacing={2}>
      <FormTextField control={control} name="title" label="Title" required />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <FormSelectField
          control={control}
          name="category"
          label="Category"
          required
          options={DOCUMENT_CATEGORIES.map((value) => ({ value, label: value }))}
        />
        <FormDateField control={control} name="expiryDate" label="Expiry date (optional)" helperText="E.g. warranty or agreement end date" />
      </Stack>
      <Controller
        control={control}
        name="links"
        render={({ field }) => {
          const selected = targets.filter((target) => field.value.some((link) => sameLink(link, target)));
          return (
            <Autocomplete<LinkTarget, true>
              multiple
              options={targets}
              value={selected}
              groupBy={(option) => LINK_TYPE_LABELS[option.type]}
              getOptionLabel={(option) => option.label}
              getOptionKey={(option) => `${option.type}:${option.id}`}
              isOptionEqualToValue={(option, value) => sameLink(option, value)}
              onChange={(_, value) => field.onChange(value.map(({ type, id }) => ({ type, id })))}
              renderOption={(props, option) => {
                const { key, ...rest } = props as typeof props & { key: string };
                return (
                  <li key={key} {...rest}>
                    <Stack>
                      <span>{option.label}</span>
                      {option.secondary && <span style={{ fontSize: 12, opacity: 0.7 }}>{option.secondary}</span>}
                    </Stack>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField {...params} label="Linked records (optional)" helperText="Link to an asset, bill, expense or maintenance task" />
              )}
              noOptionsText="Nothing to link yet"
            />
          );
        }}
      />
      <FormTextField control={control} name="notes" label="Notes (optional)" multiline minRows={2} />
    </Stack>
  );
}
