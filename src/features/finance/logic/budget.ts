import type { Budget, Expense, Minor } from '@/types/models';
import { monthKey } from '@/lib/dates';

export type BudgetState = 'ok' | 'warning' | 'over';

/** `over` once spending exceeds the limit; `warning` from `warningPercent` of the limit. */
export function budgetState(actualMinor: Minor, limitMinor: Minor, warningPercent: number): BudgetState {
  if (actualMinor > limitMinor) return 'over';
  if (limitMinor > 0 && actualMinor * 100 >= limitMinor * warningPercent) return 'warning';
  return 'ok';
}

export interface CategoryBudgetSummary {
  category: string;
  limitMinor: Minor;
  actualMinor: Minor;
  remainingMinor: Minor;
  /** Whole percent used (may exceed 100). */
  percentUsed: number;
  state: BudgetState;
}

export interface BudgetSummary {
  month: string;
  /** Overall monthly budget, or the sum of category limits when no overall figure is set. */
  plannedMinor: Minor;
  actualMinor: Minor;
  remainingMinor: Minor;
  percentUsed: number;
  state: BudgetState;
  categories: CategoryBudgetSummary[];
  /** Spending in categories that have no limit of their own. */
  unbudgeted: { category: string; actualMinor: Minor }[];
}

function percent(actual: Minor, limit: Minor): number {
  if (limit <= 0) return actual > 0 ? 100 : 0;
  return Math.round((actual * 100) / limit);
}

/** Budget position for one month, computed only from recorded expenses. */
export function budgetSummary(budget: Budget, expenses: Expense[], month: string): BudgetSummary {
  const actualByCategory = new Map<string, number>();
  let actualMinor = 0;
  for (const expense of expenses) {
    if (monthKey(expense.date) !== month) continue;
    actualMinor += expense.amountMinor;
    actualByCategory.set(expense.category, (actualByCategory.get(expense.category) ?? 0) + expense.amountMinor);
  }
  const categories = budget.categories.map((entry): CategoryBudgetSummary => {
    const actual = actualByCategory.get(entry.category) ?? 0;
    return {
      category: entry.category,
      limitMinor: entry.limitMinor,
      actualMinor: actual,
      remainingMinor: entry.limitMinor - actual,
      percentUsed: percent(actual, entry.limitMinor),
      state: budgetState(actual, entry.limitMinor, budget.warningPercent),
    };
  });
  const budgeted = new Set(budget.categories.map((entry) => entry.category));
  const unbudgeted = [...actualByCategory.entries()]
    .filter(([category]) => !budgeted.has(category))
    .map(([category, actual]) => ({ category, actualMinor: actual }))
    .sort((a, b) => b.actualMinor - a.actualMinor);
  const plannedMinor = budget.overallMinor ?? budget.categories.reduce((sum, entry) => sum + entry.limitMinor, 0);
  return {
    month,
    plannedMinor,
    actualMinor,
    remainingMinor: plannedMinor - actualMinor,
    percentUsed: percent(actualMinor, plannedMinor),
    state: budgetState(actualMinor, plannedMinor, budget.warningPercent),
    categories,
    unbudgeted,
  };
}
