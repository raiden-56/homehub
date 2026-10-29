import type { Tables } from '@/store/dataSlice';
import type { ISODate } from '@/types/models';
import { addDaysISO, addMonthsISO, daysBetween, formatShortDate, monthKey } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { paths } from '@/app/paths';
import { expiryStatus, stockStatus } from '@/features/inventory/logic';
import { maintenanceDueStatus } from '@/features/maintenance/logic';

export interface Insight {
  key: string;
  tone: 'positive' | 'attention' | 'neutral';
  text: string;
  to: string;
}

/**
 * Deterministic, plain-language observations computed from the household's own records. Each
 * insight is only produced when the underlying data supports it — never guessed.
 */
export function computeInsights(data: Tables, today: ISODate, currency: string, enabledModules: string[]): Insight[] {
  const insights: Insight[] = [];
  const has = (module: string) => enabledModules.includes(module);

  if (has('finance')) {
    // Compare month-to-date spending with the same span of last month (only when both have data).
    const dayOfMonth = Number(today.slice(8, 10));
    const thisMonth = monthKey(today);
    const lastMonthStart = addMonthsISO(`${thisMonth}-01`, -1);
    const lastMonthSameDay = addDaysISO(lastMonthStart, dayOfMonth - 1);
    let current = 0;
    let previous = 0;
    let previousCount = 0;
    for (const expense of Object.values(data.expenses)) {
      if (monthKey(expense.date) === thisMonth && expense.date <= today) current += expense.amountMinor;
      if (expense.date >= lastMonthStart && expense.date <= lastMonthSameDay && monthKey(expense.date) === monthKey(lastMonthStart)) {
        previous += expense.amountMinor;
        previousCount += 1;
      }
    }
    if (previousCount > 0 && current > 0) {
      const change = Math.round(((current - previous) / previous) * 100);
      if (Math.abs(change) >= 10) {
        insights.push({
          key: 'spending-trend',
          tone: change > 0 ? 'attention' : 'positive',
          text:
            change > 0
              ? `Spending so far this month is ${change}% higher than at this point last month (${formatMoney(current, currency)} vs ${formatMoney(previous, currency)}).`
              : `Spending so far this month is ${-change}% lower than at this point last month (${formatMoney(current, currency)} vs ${formatMoney(previous, currency)}).`,
          to: paths.reports({ range: 'month' }),
        });
      }
    }

    const nextBill = Object.values(data.billOccurrences)
      .filter((occurrence) => occurrence.state === 'open' && occurrence.dueDate >= today && daysBetween(today, occurrence.dueDate) <= 7)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const bill = nextBill ? data.bills[nextBill.billId] : undefined;
    if (nextBill && bill) {
      const days = daysBetween(today, nextBill.dueDate);
      insights.push({
        key: 'next-bill',
        tone: 'neutral',
        text: `Your ${bill.name.toLowerCase()} bill (${formatMoney(nextBill.amountMinor, currency)}) is due ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}.`,
        to: paths.billOccurrence(nextBill.id),
      });
    }
  }

  if (has('inventory')) {
    const active = Object.values(data.inventoryItems).filter((item) => !item.archived && item.quantity > 0);
    const expiringSoon = active.filter((item) => expiryStatus(item, today, 3) === 'soon');
    if (expiringSoon.length > 0) {
      insights.push({
        key: 'expiring',
        tone: 'attention',
        text:
          expiringSoon.length === 1
            ? `${expiringSoon[0]!.name} expires within 3 days — plan to use it soon.`
            : `${expiringSoon.length} items expire within 3 days, including ${expiringSoon
                .slice(0, 2)
                .map((item) => item.name)
                .join(' and ')}.`,
        to: paths.inventory({ expiry: 'soon' }),
      });
    }
    const needRestock = Object.values(data.inventoryItems).filter((item) => !item.archived && stockStatus(item) !== 'ok');
    if (needRestock.length > 0) {
      insights.push({
        key: 'restock',
        tone: 'attention',
        text: `${needRestock.length} ${needRestock.length === 1 ? 'item needs' : 'items need'} restocking.`,
        to: paths.inventory({ stock: 'low' }),
      });
    }
  }

  if (has('maintenance')) {
    const nextWeek = Object.values(data.maintenanceTasks).filter((task) => {
      const status = maintenanceDueStatus(task, today, 7);
      return status === 'due-soon';
    });
    if (nextWeek.length > 0) {
      insights.push({
        key: 'maintenance-week',
        tone: 'neutral',
        text:
          nextWeek.length === 1
            ? `${nextWeek[0]!.name} is due ${formatShortDate(nextWeek[0]!.dueDate)}.`
            : `${nextWeek.length} maintenance tasks are due in the next week.`,
        to: paths.maintenance({ due: 'upcoming' }),
      });
    }
  }

  if (has('tasks')) {
    const weekAgo = addDaysISO(today, -6);
    const completed = Object.values(data.tasks).filter(
      (task) => task.status === 'completed' && task.completedAt && task.completedAt.slice(0, 10) >= weekAgo,
    );
    if (completed.length >= 3) {
      insights.push({
        key: 'tasks-done',
        tone: 'positive',
        text: `The household completed ${completed.length} tasks in the last 7 days.`,
        to: paths.tasks({ status: 'completed' }),
      });
    }
  }

  return insights;
}
