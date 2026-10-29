import type { Expense, ISODate, Minor } from '@/types/models';
import { addMonthsISO, monthKey } from '@/lib/dates';

/** Every `YYYY-MM` key from `fromMonth` to `toMonth` inclusive. */
export function monthsBetween(fromMonth: string, toMonth: string): string[] {
  const months: string[] = [];
  let cursor = `${fromMonth}-01`;
  for (let guard = 0; guard < 600 && monthKey(cursor) <= toMonth; guard += 1) {
    months.push(monthKey(cursor));
    cursor = addMonthsISO(cursor, 1);
  }
  return months;
}

export function shiftMonth(month: string, delta: number): string {
  return monthKey(addMonthsISO(`${month}-01`, delta));
}

/** Monthly totals from recorded expenses; months without spending are included as zero. */
export function spendingByMonth(
  expenses: Expense[],
  fromMonth: string,
  toMonth: string,
): { month: string; totalMinor: number; byCategory: Record<string, number> }[] {
  const rows = new Map(monthsBetween(fromMonth, toMonth).map((month) => [month, { month, totalMinor: 0, byCategory: {} as Record<string, number> }]));
  for (const expense of expenses) {
    const row = rows.get(monthKey(expense.date));
    if (!row) continue;
    row.totalMinor += expense.amountMinor;
    row.byCategory[expense.category] = (row.byCategory[expense.category] ?? 0) + expense.amountMinor;
  }
  return [...rows.values()];
}

export function expensesBetween(expenses: Expense[], from: ISODate, to: ISODate): Expense[] {
  return expenses.filter((expense) => expense.date >= from && expense.date <= to);
}

/** Category totals for `from <= date <= to`, largest first. */
export function spendingByCategory(expenses: Expense[], from: ISODate, to: ISODate): { category: string; totalMinor: number }[] {
  const totals = new Map<string, number>();
  for (const expense of expensesBetween(expenses, from, to)) {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amountMinor);
  }
  return [...totals.entries()]
    .map(([category, totalMinor]) => ({ category, totalMinor }))
    .sort((a, b) => b.totalMinor - a.totalMinor || a.category.localeCompare(b.category));
}

/** Amount each member actually paid (the payer of each expense), largest first. */
export function contributionsByMember(expenses: Expense[]): { userId: string; totalMinor: Minor }[] {
  const totals = new Map<string, number>();
  for (const expense of expenses) totals.set(expense.payerId, (totals.get(expense.payerId) ?? 0) + expense.amountMinor);
  return [...totals.entries()].map(([userId, totalMinor]) => ({ userId, totalMinor })).sort((a, b) => b.totalMinor - a.totalMinor);
}

export type ReportRange = 'month' | '3m' | '6m' | '12m' | 'ytd';

export const REPORT_RANGE_LABELS: Record<ReportRange, string> = {
  month: 'This month',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
  ytd: 'Year to date',
};

export function isReportRange(value: string | null): value is ReportRange {
  return value !== null && value in REPORT_RANGE_LABELS;
}

/** Resolves a range key into inclusive dates/months ending today (month ranges include the current month). */
export function resolveRange(range: ReportRange, today: ISODate): { from: ISODate; to: ISODate; fromMonth: string; toMonth: string } {
  const toMonth = monthKey(today);
  let fromMonth: string;
  switch (range) {
    case 'month':
      fromMonth = toMonth;
      break;
    case '3m':
      fromMonth = shiftMonth(toMonth, -2);
      break;
    case '6m':
      fromMonth = shiftMonth(toMonth, -5);
      break;
    case '12m':
      fromMonth = shiftMonth(toMonth, -11);
      break;
    case 'ytd':
      fromMonth = `${today.slice(0, 4)}-01`;
      break;
  }
  return { from: `${fromMonth}-01`, to: today, fromMonth, toMonth };
}
