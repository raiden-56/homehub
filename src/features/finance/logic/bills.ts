import type { Bill, BillOccurrence, ISODate } from '@/types/models';
import { addDaysISO, daysBetween } from '@/lib/dates';
import { occurrencesBetween } from '@/lib/recurrence';

export type BillStatus = 'upcoming' | 'due-soon' | 'overdue' | 'paid' | 'cancelled';

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  upcoming: 'Upcoming',
  'due-soon': 'Due soon',
  overdue: 'Overdue',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

/** How far ahead recurring bill occurrences are materialised. */
export const BILL_HORIZON_DAYS = 120;
export const DEFAULT_DUE_SOON_DAYS = 7;

/** Status is derived from the stored state plus today's date, never stored. */
export function billStatus(occurrence: BillOccurrence, today: ISODate, dueSoonDays = DEFAULT_DUE_SOON_DAYS): BillStatus {
  if (occurrence.state === 'paid') return 'paid';
  if (occurrence.state === 'cancelled') return 'cancelled';
  const days = daysBetween(today, occurrence.dueDate);
  if (days < 0) return 'overdue';
  if (days <= dueSoonDays) return 'due-soon';
  return 'upcoming';
}

/** Deterministic id: regenerating the same occurrence can never create a duplicate. */
export function billOccurrenceId(billId: string, originalDate: ISODate): string {
  return `${billId}_${originalDate}`;
}

/**
 * Returns occurrences of `bill` that should exist (from its start date — or the last 31 days for
 * long-running series — up to `today + horizonDays`) but are not yet in `existingIds`.
 * One-off bills produce a single occurrence on their start date.
 */
export function missingBillOccurrences(
  bill: Bill,
  existingIds: ReadonlySet<string>,
  today: ISODate,
  now: string,
  horizonDays = BILL_HORIZON_DAYS,
): BillOccurrence[] {
  if (!bill.active) return [];
  const horizon = addDaysISO(today, horizonDays);
  const lookbackStart = addDaysISO(today, -31);
  const from = bill.startDate > lookbackStart ? bill.startDate : lookbackStart;
  const dates = bill.recurrence
    ? occurrencesBetween(bill.recurrence, bill.startDate, from, horizon)
    : bill.startDate <= horizon
      ? [bill.startDate]
      : [];
  return dates
    .filter((date) => !existingIds.has(billOccurrenceId(bill.id, date)))
    .map((date) => ({
      id: billOccurrenceId(bill.id, date),
      householdId: bill.householdId,
      billId: bill.id,
      originalDate: date,
      dueDate: date,
      amountMinor: bill.amountMinor,
      state: 'open',
      createdAt: now,
      updatedAt: now,
    }));
}

/** Approximate monthly cost of a bill series, for comparing commitments with different schedules. */
export function monthlyEquivalentMinor(bill: Pick<Bill, 'amountMinor' | 'recurrence'>): number {
  const rule = bill.recurrence;
  if (!rule) return 0;
  const interval = Math.max(1, rule.interval);
  switch (rule.frequency) {
    case 'daily':
      return Math.round((bill.amountMinor * 365) / 12 / interval);
    case 'weekly': {
      const perWeek = Math.max(1, rule.byWeekday?.length ?? 1);
      return Math.round((bill.amountMinor * perWeek * 52) / 12 / interval);
    }
    case 'monthly':
      return Math.round(bill.amountMinor / interval);
    case 'quarterly':
      return Math.round(bill.amountMinor / (3 * interval));
    case 'yearly':
      return Math.round(bill.amountMinor / (12 * interval));
  }
}

/** Unpaid occurrences of `billId` scheduled for today or later (safe to regenerate). */
export function futureOpenOccurrences(billId: string, occurrences: BillOccurrence[], today: ISODate): BillOccurrence[] {
  return occurrences.filter(
    (occurrence) => occurrence.billId === billId && occurrence.state === 'open' && occurrence.originalDate >= today,
  );
}
