import { describe, expect, it } from 'vitest';
import type { Budget, Expense } from '@/types/models';
import { budgetState, budgetSummary } from '../logic/budget';
import { contributionsByMember, monthsBetween, resolveRange, spendingByCategory, spendingByMonth } from '../logic/spending';

const NOW = '2026-10-29T08:00:00.000Z';

function expense(date: string, category: string, amountMinor: number, payerId = 'a'): Expense {
  return {
    id: `${date}-${category}-${amountMinor}`,
    householdId: 'h1',
    description: category,
    amountMinor,
    date,
    category,
    payerId,
    source: 'manual',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const expenses = [
  expense('2026-08-03', 'Groceries', 2000),
  expense('2026-10-01', 'Groceries', 9000, 'b'),
  expense('2026-10-10', 'Dining out', 5000),
  expense('2026-10-20', 'Transport', 700, 'b'),
  expense('2026-11-01', 'Groceries', 999),
];

describe('budget', () => {
  const budget: Budget = {
    id: 'h1',
    householdId: 'h1',
    overallMinor: 20000,
    warningPercent: 80,
    categories: [
      { category: 'Groceries', limitMinor: 10000 },
      { category: 'Dining out', limitMinor: 4000 },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('classifies spending against a limit', () => {
    expect(budgetState(7900, 10000, 80)).toBe('ok');
    expect(budgetState(8000, 10000, 80)).toBe('warning');
    expect(budgetState(10000, 10000, 80)).toBe('warning');
    expect(budgetState(10001, 10000, 80)).toBe('over');
  });

  it('summarises a month from recorded expenses only', () => {
    const summary = budgetSummary(budget, expenses, '2026-10');
    expect(summary.plannedMinor).toBe(20000);
    expect(summary.actualMinor).toBe(14700);
    expect(summary.remainingMinor).toBe(5300);
    expect(summary.percentUsed).toBe(74);
    expect(summary.state).toBe('ok');
    expect(summary.categories).toEqual([
      expect.objectContaining({ category: 'Groceries', actualMinor: 9000, percentUsed: 90, state: 'warning' }),
      expect.objectContaining({ category: 'Dining out', actualMinor: 5000, remainingMinor: -1000, state: 'over' }),
    ]);
    expect(summary.unbudgeted).toEqual([{ category: 'Transport', actualMinor: 700 }]);
  });

  it('falls back to the sum of category limits without an overall budget', () => {
    expect(budgetSummary({ ...budget, overallMinor: undefined }, [], '2026-10').plannedMinor).toBe(14000);
  });
});

describe('spending', () => {
  it('lists every month in range, including months without spending', () => {
    const rows = spendingByMonth(expenses, '2026-08', '2026-11');
    expect(rows.map((row) => row.month)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11']);
    expect(rows.map((row) => row.totalMinor)).toEqual([2000, 0, 14700, 999]);
    expect(rows[2]!.byCategory).toEqual({ Groceries: 9000, 'Dining out': 5000, Transport: 700 });
  });

  it('handles ranges across a year boundary', () => {
    expect(monthsBetween('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('totals categories within an inclusive date range, largest first', () => {
    expect(spendingByCategory(expenses, '2026-10-01', '2026-10-31')).toEqual([
      { category: 'Groceries', totalMinor: 9000 },
      { category: 'Dining out', totalMinor: 5000 },
      { category: 'Transport', totalMinor: 700 },
    ]);
  });

  it('totals what each member paid', () => {
    expect(contributionsByMember(expenses)).toEqual([
      { userId: 'b', totalMinor: 9700 },
      { userId: 'a', totalMinor: 7999 },
    ]);
  });

  it('resolves report ranges ending today', () => {
    expect(resolveRange('3m', '2026-10-29')).toEqual({ from: '2026-08-01', to: '2026-10-29', fromMonth: '2026-08', toMonth: '2026-10' });
    expect(resolveRange('ytd', '2026-10-29').fromMonth).toBe('2026-01');
  });
});
