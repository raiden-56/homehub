import { useMemo } from 'react';
import { useActiveHousehold, useAppSelector, useCollection } from '@/app/hooks';
import { selectCurrentPreferences } from '@/store/selectors';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import { DEFAULT_DUE_SOON_DAYS } from './logic/bills';

/** Due-soon window from the current member's notification preferences. */
export function useBillLeadDays(): number {
  const preferences = useAppSelector(selectCurrentPreferences);
  return preferences?.notifications.billLeadDays ?? DEFAULT_DUE_SOON_DAYS;
}

/** Built-in categories, the household's custom ones, and any legacy category still used by an expense. */
export function useExpenseCategories(): string[] {
  const household = useActiveHousehold();
  const expenses = useCollection('expenses');
  return useMemo(() => {
    const all = new Set([...EXPENSE_CATEGORIES, ...(household?.customExpenseCategories ?? [])]);
    for (const expense of expenses) all.add(expense.category);
    return [...all];
  }, [household?.customExpenseCategories, expenses]);
}
