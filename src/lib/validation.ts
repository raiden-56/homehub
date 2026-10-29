import { z } from 'zod';
import { isISODate } from './dates';
import { parseMoneyInput } from './money';
import type { RecurrenceFrequency, RecurrenceRule } from '@/types/models';

/**
 * Form values keep numbers, money and dates as strings (exactly what the inputs produce) and
 * convert them on submit. These helpers validate those strings.
 */

export const requiredText = (label: string, max = 120) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

export const optionalText = (max = 1000) => z.string().trim().max(max, `Must be ${max} characters or fewer`);

export const moneyString = (options: { required?: boolean; label?: string; currency?: string } = {}) =>
  z.string().superRefine((value, ctx) => {
    if (value.trim() === '') {
      if (options.required) ctx.addIssue({ code: 'custom', message: `${options.label ?? 'Amount'} is required` });
      return;
    }
    const parsed = parseMoneyInput(value, options.currency);
    if (parsed === null) ctx.addIssue({ code: 'custom', message: 'Enter a valid amount, e.g. 1250.50' });
    else if (options.required && parsed === 0) ctx.addIssue({ code: 'custom', message: 'Amount must be more than zero' });
  });

export const numberString = (
  options: { required?: boolean; label?: string; min?: number; max?: number; integer?: boolean } = {},
) =>
  z.string().superRefine((value, ctx) => {
    const label = options.label ?? 'Value';
    if (value.trim() === '') {
      if (options.required) ctx.addIssue({ code: 'custom', message: `${label} is required` });
      return;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: 'custom', message: `${label} must be a number` });
      return;
    }
    if (options.integer && !Number.isInteger(parsed)) ctx.addIssue({ code: 'custom', message: `${label} must be a whole number` });
    if (options.min !== undefined && parsed < options.min) ctx.addIssue({ code: 'custom', message: `${label} must be at least ${options.min}` });
    if (options.max !== undefined && parsed > options.max) ctx.addIssue({ code: 'custom', message: `${label} must be at most ${options.max}` });
  });

export const dateString = (options: { required?: boolean; label?: string } = {}) =>
  z.string().superRefine((value, ctx) => {
    if (value === '') {
      if (options.required) ctx.addIssue({ code: 'custom', message: `${options.label ?? 'Date'} is required` });
      return;
    }
    if (!isISODate(value)) ctx.addIssue({ code: 'custom', message: 'Enter a valid date' });
  });

export const timeString = () =>
  z.string().refine((value) => value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), 'Enter a valid time');

/** Converts optional string fields to `undefined` when blank. */
export function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function toNumber(value: string): number {
  return Number(value);
}

export function toOptionalNumber(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

/* ------------------------------------------------------------------ */
/* Recurrence form values                                              */
/* ------------------------------------------------------------------ */

export type RepeatOption = 'none' | RecurrenceFrequency;

export const recurrenceFormSchema = z
  .object({
    repeat: z.enum(['none', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
    interval: z.string(),
    weekdays: z.array(z.number().int().min(0).max(6)),
    until: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.repeat === 'none') return;
    const interval = Number(value.interval);
    if (!Number.isInteger(interval) || interval < 1 || interval > 99) {
      ctx.addIssue({ code: 'custom', path: ['interval'], message: 'Enter a whole number from 1 to 99' });
    }
    if (value.until !== '' && !isISODate(value.until)) {
      ctx.addIssue({ code: 'custom', path: ['until'], message: 'Enter a valid end date' });
    }
  });

export type RecurrenceFormValue = z.infer<typeof recurrenceFormSchema>;

export const NO_RECURRENCE: RecurrenceFormValue = { repeat: 'none', interval: '1', weekdays: [], until: '' };

export function recurrenceToForm(rule: RecurrenceRule | undefined): RecurrenceFormValue {
  if (!rule) return { ...NO_RECURRENCE };
  return {
    repeat: rule.frequency,
    interval: String(rule.interval),
    weekdays: rule.byWeekday ?? [],
    until: rule.until ?? '',
  };
}

export function formToRecurrence(value: RecurrenceFormValue): RecurrenceRule | undefined {
  if (value.repeat === 'none') return undefined;
  return {
    frequency: value.repeat,
    interval: Math.max(1, Number(value.interval) || 1),
    ...(value.repeat === 'weekly' && value.weekdays.length > 0 ? { byWeekday: [...value.weekdays].sort() } : {}),
    ...(value.until ? { until: value.until } : {}),
  };
}
