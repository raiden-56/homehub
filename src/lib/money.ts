import type { Minor } from '@/types/models';

export const SUPPORTED_CURRENCIES = [
  { code: 'INR', label: 'Indian rupee (₹)' },
  { code: 'USD', label: 'US dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'GBP', label: 'British pound (£)' },
  { code: 'AED', label: 'UAE dirham (AED)' },
  { code: 'SGD', label: 'Singapore dollar (S$)' },
  { code: 'AUD', label: 'Australian dollar (A$)' },
  { code: 'CAD', label: 'Canadian dollar (C$)' },
  { code: 'JPY', label: 'Japanese yen (¥)' },
] as const;

const LOCALE_BY_CURRENCY: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
  AED: 'en-AE',
  SGD: 'en-SG',
  AUD: 'en-AU',
  CAD: 'en-CA',
  JPY: 'ja-JP',
};

export function localeForCurrency(currency: string): string {
  return LOCALE_BY_CURRENCY[currency] ?? 'en-IN';
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${currency}:${compact}`;
  let cached = formatterCache.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(localeForCurrency(currency), {
      style: 'currency',
      currency,
      ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
    });
    formatterCache.set(key, cached);
  }
  return cached;
}

/** Number of decimal places used by a currency's minor unit (2 for INR, 0 for JPY). */
export function minorUnitDigits(currency: string): number {
  return formatter(currency, false).resolvedOptions().maximumFractionDigits ?? 2;
}

/** Converts minor units to a major-unit number — for chart axes and display only, never for arithmetic. */
export function toMajor(minor: Minor, currency: string): number {
  return minor / 10 ** minorUnitDigits(currency);
}

export function formatMoney(minor: Minor, currency = 'INR', options: { compact?: boolean } = {}): string {
  return formatter(currency, options.compact ?? false).format(toMajor(minor, currency));
}

/**
 * Parses user input such as "1,250.50" into integer minor units without floating-point
 * arithmetic. Returns `null` for anything that is not a non-negative amount with at most
 * the currency's number of decimals.
 */
export function parseMoneyInput(input: string, currency = 'INR'): Minor | null {
  const digits = minorUnitDigits(currency);
  const cleaned = input.trim().replace(/[,\s_]/g, '');
  const pattern = digits > 0 ? new RegExp(`^(\\d+)(?:\\.(\\d{0,${digits}}))?$`) : /^(\d+)$/;
  const match = pattern.exec(cleaned);
  if (!match) return null;
  const whole = match[1] ?? '0';
  const fraction = (match[2] ?? '').padEnd(digits, '0');
  const value = Number(whole + fraction);
  return Number.isSafeInteger(value) ? value : null;
}

/** Inverse of `parseMoneyInput`, used to prefill form fields (no grouping separators). */
export function minorToInput(minor: Minor | undefined, currency = 'INR'): string {
  if (minor === undefined) return '';
  const digits = minorUnitDigits(currency);
  if (digits === 0) return String(minor);
  const sign = minor < 0 ? '-' : '';
  const abs = String(Math.abs(minor)).padStart(digits + 1, '0');
  return `${sign}${abs.slice(0, -digits)}.${abs.slice(-digits)}`;
}

export function sumMinor(values: Iterable<Minor | undefined>): Minor {
  let total = 0;
  for (const value of values) total += value ?? 0;
  return total;
}

/** Splits `total` into `count` integer parts that differ by at most one minor unit. */
export function allocateEvenly(total: Minor, count: number): Minor[] {
  if (count <= 0) return [];
  const base = Math.trunc(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

/**
 * Allocates `total` proportionally to `weights` using the largest-remainder method, so the
 * parts always sum exactly to `total`.
 */
export function allocateByWeights(total: Minor, weights: number[]): Minor[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weights.length === 0 || weightSum <= 0) return weights.map(() => 0);
  const raw = weights.map((weight) => (total * weight) / weightSum);
  const floors = raw.map((value) => Math.floor(value));
  let remainder = total - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of order) {
    if (remainder <= 0) break;
    floors[index] = (floors[index] ?? 0) + 1;
    remainder -= 1;
  }
  return floors;
}
