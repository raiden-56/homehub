import type { ChangeSet } from '@/data/collections';
import type { Bill, BillOccurrence, Expense, ExpenseSplit, ISODate, Minor } from '@/types/models';
import { BILL_TO_EXPENSE_CATEGORY } from '@/lib/constants';
import { futureOpenOccurrences, missingBillOccurrences } from './bills';

export interface BillPaymentInput {
  occurrence: BillOccurrence;
  bill: Bill;
  paidAt: ISODate;
  amountMinor: Minor;
  payerId: string;
  recordExpense: boolean;
  split?: ExpenseSplit;
  paymentMethod?: string;
  expenseId: string;
  now: string;
}

/** Idempotency key for paying one version of an occurrence (undoing a payment bumps `updatedAt`). */
export function billPaymentKey(occurrence: BillOccurrence): string {
  return `bill-paid:${occurrence.id}:${occurrence.updatedAt}`;
}

/** Marks an occurrence paid and, optionally, records the matching expense — one atomic change set. */
export function buildBillPayment(input: BillPaymentInput): { changes: ChangeSet; expense?: Expense } {
  const { occurrence, bill, now } = input;
  const expense: Expense | undefined = input.recordExpense
    ? {
        id: input.expenseId,
        householdId: occurrence.householdId,
        description: bill.name,
        amountMinor: input.amountMinor,
        date: input.paidAt,
        category: BILL_TO_EXPENSE_CATEGORY[bill.category] ?? 'Other',
        payerId: input.payerId,
        paymentMethod: input.paymentMethod,
        source: 'bill',
        sourceId: occurrence.id,
        split: input.split,
        createdAt: now,
        updatedAt: now,
      }
    : undefined;
  const paid: BillOccurrence = {
    ...occurrence,
    state: 'paid',
    paidAt: input.paidAt,
    paidAmountMinor: input.amountMinor,
    paidBy: input.payerId,
    expenseId: expense?.id,
    updatedAt: now,
  };
  return {
    expense,
    changes: { put: { billOccurrences: [paid], ...(expense ? { expenses: [expense] } : {}) } },
  };
}

/** Reopens a paid occurrence and removes the expense its payment created (if it still exists). */
export function buildUndoPayment(occurrence: BillOccurrence, expenseExists: boolean, now: string): ChangeSet {
  const reopened: BillOccurrence = {
    ...occurrence,
    state: 'open',
    paidAt: undefined,
    paidAmountMinor: undefined,
    paidBy: undefined,
    expenseId: undefined,
    updatedAt: now,
  };
  return {
    put: { billOccurrences: [reopened] },
    ...(occurrence.expenseId && expenseExists ? { remove: { expenses: [occurrence.expenseId] } } : {}),
  };
}

/**
 * Saves an edited bill series. When the amount or schedule changes, unpaid upcoming occurrences
 * are rebuilt from the new definition; paid and past occurrences are never touched.
 */
export function buildSeriesUpdate(
  previous: Bill | undefined,
  next: Bill,
  occurrences: BillOccurrence[],
  today: ISODate,
  now: string,
): ChangeSet {
  const scheduleChanged =
    !previous ||
    previous.amountMinor !== next.amountMinor ||
    previous.startDate !== next.startDate ||
    JSON.stringify(previous.recurrence ?? null) !== JSON.stringify(next.recurrence ?? null) ||
    previous.active !== next.active;
  if (!scheduleChanged) return { put: { bills: [next] } };

  const stale = previous ? futureOpenOccurrences(next.id, occurrences, today) : [];
  const staleIds = new Set(stale.map((occurrence) => occurrence.id));
  const keep = new Set(occurrences.filter((occurrence) => !staleIds.has(occurrence.id)).map((occurrence) => occurrence.id));
  const regenerated = missingBillOccurrences(next, keep, today, now);
  const regeneratedIds = new Set(regenerated.map((occurrence) => occurrence.id));
  // Ids that are regenerated are overwritten by `put`; only the rest are removed.
  const removeIds = [...staleIds].filter((id) => !regeneratedIds.has(id));
  return {
    put: { bills: [next], ...(regenerated.length ? { billOccurrences: regenerated } : {}) },
    ...(removeIds.length ? { remove: { billOccurrences: removeIds } } : {}),
  };
}
