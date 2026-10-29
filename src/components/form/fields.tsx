import type { ReactNode } from 'react';
import {
  Checkbox,
  FormControlLabel,
  FormHelperText,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  type TextFieldProps,
} from '@mui/material';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useCurrency, useMembers } from '@/app/hooks';
import { formatMoney } from '@/lib/money';
import { WEEKDAY_SHORT } from '@/lib/recurrence';
import type { RecurrenceFormValue, RepeatOption } from '@/lib/validation';

interface BaseFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  helperText?: ReactNode;
  required?: boolean;
  disabled?: boolean;
}

type PassThrough = Omit<TextFieldProps, 'name' | 'label' | 'value' | 'onChange' | 'error' | 'helperText' | 'required'>;

export function FormTextField<T extends FieldValues>({
  control,
  name,
  label,
  helperText,
  required,
  disabled,
  ...rest
}: BaseFieldProps<T> & PassThrough) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...rest}
          {...field}
          value={field.value ?? ''}
          label={label}
          required={required}
          disabled={disabled}
          error={!!fieldState.error}
          helperText={fieldState.error?.message ?? helperText}
        />
      )}
    />
  );
}

export function FormNumberField<T extends FieldValues>(
  props: BaseFieldProps<T> & PassThrough & { unit?: string; step?: string },
) {
  const { unit, step = 'any', slotProps, ...rest } = props;
  return (
    <FormTextField
      {...rest}
      type="number"
      slotProps={{
        ...slotProps,
        htmlInput: { inputMode: 'decimal', step, min: 0 },
        input: unit ? { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> } : undefined,
      }}
    />
  );
}

/** Money input: the form value is a decimal string; convert with `parseMoneyInput` on submit. */
export function FormMoneyField<T extends FieldValues>(props: BaseFieldProps<T> & PassThrough) {
  const currency = useCurrency();
  const symbol = formatMoney(0, currency).replace(/[\d.,\s]/g, '') || currency;
  return (
    <FormTextField
      {...props}
      slotProps={{
        htmlInput: { inputMode: 'decimal', autoComplete: 'off' },
        input: { startAdornment: <InputAdornment position="start">{symbol}</InputAdornment> },
      }}
    />
  );
}

export function FormDateField<T extends FieldValues>(props: BaseFieldProps<T> & PassThrough) {
  return <FormTextField {...props} type="date" slotProps={{ inputLabel: { shrink: true } }} />;
}

export function FormTimeField<T extends FieldValues>(props: BaseFieldProps<T> & PassThrough) {
  return <FormTextField {...props} type="time" slotProps={{ inputLabel: { shrink: true } }} />;
}

export interface SelectOption {
  value: string;
  label: string;
}

export function FormSelectField<T extends FieldValues>({
  options,
  emptyLabel,
  ...props
}: BaseFieldProps<T> & PassThrough & { options: SelectOption[]; emptyLabel?: string }) {
  return (
    <FormTextField {...props} select>
      {emptyLabel !== undefined && (
        <MenuItem value="">
          <em>{emptyLabel}</em>
        </MenuItem>
      )}
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </FormTextField>
  );
}

/** Select a member of the active household. Empty string means "unassigned". */
export function FormMemberSelect<T extends FieldValues>({
  emptyLabel = 'Unassigned',
  includeViewers = false,
  ...props
}: BaseFieldProps<T> & PassThrough & { emptyLabel?: string | null; includeViewers?: boolean }) {
  const members = useMembers();
  const options = members
    .filter((member) => includeViewers || member.role !== 'viewer')
    .map((member) => ({ value: member.userId, label: member.name }));
  return <FormSelectField {...props} options={options} emptyLabel={emptyLabel ?? undefined} />;
}

export function FormSwitch<T extends FieldValues>({ control, name, label, helperText, disabled }: BaseFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Stack>
          <FormControlLabel
            control={
              <Switch
                checked={!!field.value}
                onChange={(event) => field.onChange(event.target.checked)}
                disabled={disabled}
              />
            }
            label={label}
          />
          {helperText && <FormHelperText sx={{ mt: -0.5, ml: 6 }}>{helperText}</FormHelperText>}
        </Stack>
      )}
    />
  );
}

export function FormCheckbox<T extends FieldValues>({ control, name, label, helperText, disabled }: BaseFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Stack>
          <FormControlLabel
            control={
              <Checkbox
                checked={!!field.value}
                onChange={(event) => field.onChange(event.target.checked)}
                disabled={disabled}
              />
            }
            label={label}
          />
          {helperText && <FormHelperText sx={{ mt: -0.5, ml: 4 }}>{helperText}</FormHelperText>}
        </Stack>
      )}
    />
  );
}

const REPEAT_OPTIONS: { value: RepeatOption; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const UNIT_LABEL: Record<Exclude<RepeatOption, 'none'>, string> = {
  daily: 'day(s)',
  weekly: 'week(s)',
  monthly: 'month(s)',
  quarterly: 'quarter(s)',
  yearly: 'year(s)',
};

/**
 * Edits a `RecurrenceFormValue` stored at `name` (use `recurrenceFormSchema` in the form
 * schema and `formToRecurrence` on submit).
 */
export function FormRecurrenceField<T extends FieldValues>({
  control,
  name,
  label = 'Repeat',
  allowed,
}: Omit<BaseFieldProps<T>, 'label'> & { label?: string; allowed?: RepeatOption[] }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = field.value as RecurrenceFormValue;
        const errors = fieldState.error as unknown as
          | { interval?: { message?: string }; until?: { message?: string } }
          | undefined;
        const update = (patch: Partial<RecurrenceFormValue>) => field.onChange({ ...value, ...patch });
        const options = allowed ? REPEAT_OPTIONS.filter((option) => allowed.includes(option.value)) : REPEAT_OPTIONS;
        return (
          <Stack spacing={1.5}>
            <TextField
              select
              label={label}
              value={value.repeat}
              onChange={(event) => update({ repeat: event.target.value as RepeatOption })}
            >
              {options.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            {value.repeat !== 'none' && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  label="Every"
                  type="number"
                  value={value.interval}
                  onChange={(event) => update({ interval: event.target.value })}
                  error={!!errors?.interval}
                  helperText={errors?.interval?.message}
                  slotProps={{
                    htmlInput: { min: 1, max: 99, inputMode: 'numeric' },
                    input: { endAdornment: <InputAdornment position="end">{UNIT_LABEL[value.repeat]}</InputAdornment> },
                  }}
                />
                <TextField
                  label="Ends on (optional)"
                  type="date"
                  value={value.until}
                  onChange={(event) => update({ until: event.target.value })}
                  error={!!errors?.until}
                  helperText={errors?.until?.message}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Stack>
            )}
            {value.repeat === 'weekly' && (
              <Stack spacing={0.75}>
                <Typography variant="caption" color="text.secondary" id={`${name}-weekdays`}>
                  On these days (defaults to the start date’s weekday)
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  value={value.weekdays}
                  onChange={(_, weekdays: number[]) => update({ weekdays })}
                  aria-labelledby={`${name}-weekdays`}
                  sx={{ flexWrap: 'wrap' }}
                >
                  {WEEKDAY_SHORT.map((day, index) => (
                    <ToggleButton key={day} value={index} aria-label={day} sx={{ minWidth: 44 }}>
                      {day}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Stack>
            )}
          </Stack>
        );
      }}
    />
  );
}
