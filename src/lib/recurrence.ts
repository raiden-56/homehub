import { addDays, addMonths, addYears, startOfWeek } from 'date-fns';
import type { ISODate, RecurrenceFrequency, RecurrenceRule } from '@/types/models';
import { fromISODate, toISODate } from './dates';

const MAX_ITERATIONS = 20000;

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const UNIT: Record<RecurrenceFrequency, string> = {
  daily: 'days',
  weekly: 'weeks',
  monthly: 'months',
  quarterly: 'quarters',
  yearly: 'years',
};

function safeInterval(rule: RecurrenceRule): number {
  return Number.isInteger(rule.interval) && rule.interval > 0 ? rule.interval : 1;
}

/**
 * Lazily yields the occurrence dates of a series anchored at `anchor`, in ascending order.
 * Monthly/quarterly/yearly occurrences are always computed from the anchor (not cumulatively),
 * so a series anchored on the 31st lands on the last day of shorter months and returns to the
 * 31st afterwards.
 */
export function* iterateOccurrences(rule: RecurrenceRule, anchor: ISODate): Generator<ISODate> {
  const interval = safeInterval(rule);
  const start = fromISODate(anchor);
  const until = rule.until;

  const weekdays =
    rule.frequency === 'weekly' && rule.byWeekday && rule.byWeekday.length > 0
      ? [...new Set(rule.byWeekday)].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b)
      : null;

  for (let step = 0; step < MAX_ITERATIONS; step += 1) {
    let candidates: Date[];
    switch (rule.frequency) {
      case 'daily':
        candidates = [addDays(start, step * interval)];
        break;
      case 'weekly':
        if (weekdays) {
          const weekStart = addDays(startOfWeek(start), step * interval * 7);
          candidates = weekdays.map((day) => addDays(weekStart, day)).filter((date) => date >= start);
        } else {
          candidates = [addDays(start, step * interval * 7)];
        }
        break;
      case 'monthly':
        candidates = [addMonths(start, step * interval)];
        break;
      case 'quarterly':
        candidates = [addMonths(start, step * interval * 3)];
        break;
      case 'yearly':
        candidates = [addYears(start, step * interval)];
        break;
    }
    for (const candidate of candidates) {
      const iso = toISODate(candidate);
      if (until && iso > until) return;
      yield iso;
    }
  }
}

/** First occurrence strictly after `after`, or `null` when the series has ended. */
export function nextOccurrence(rule: RecurrenceRule, anchor: ISODate, after: ISODate): ISODate | null {
  for (const date of iterateOccurrences(rule, anchor)) {
    if (date > after) return date;
  }
  return null;
}

/** Occurrences with `from <= date <= to`. */
export function occurrencesBetween(
  rule: RecurrenceRule,
  anchor: ISODate,
  from: ISODate,
  to: ISODate,
): ISODate[] {
  const result: ISODate[] = [];
  for (const date of iterateOccurrences(rule, anchor)) {
    if (date > to) break;
    if (date >= from) result.push(date);
  }
  return result;
}

export function describeRecurrence(rule: RecurrenceRule | undefined): string {
  if (!rule) return 'Does not repeat';
  const interval = safeInterval(rule);
  let text = interval === 1 ? FREQUENCY_LABELS[rule.frequency] : `Every ${interval} ${UNIT[rule.frequency]}`;
  if (rule.frequency === 'weekly' && rule.byWeekday && rule.byWeekday.length > 0) {
    const days = [...rule.byWeekday].sort((a, b) => a - b).map((day) => WEEKDAY_SHORT[day]);
    text += ` on ${days.join(', ')}`;
  }
  if (rule.until) text += ` until ${rule.until}`;
  return text;
}
