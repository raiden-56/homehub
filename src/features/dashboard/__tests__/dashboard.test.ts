import { describe, expect, it } from 'vitest';
import { computeSummary } from '../summary';
import { computeInsights } from '../insights';
import { resolveWidgets, DEFAULT_WIDGETS } from '../layout';
import { buildDemoHousehold } from '@/features/household/demo';
import { HOUSEHOLD_COLLECTIONS, GLOBAL_COLLECTIONS } from '@/data/collections';
import type { Tables } from '@/store/dataSlice';
import { todayIn } from '@/lib/dates';

function tablesFromDemo() {
  const { changes } = buildDemoHousehold('owner-1');
  const tables: Record<string, Record<string, { id: string }>> = {};
  for (const name of [...GLOBAL_COLLECTIONS, ...HOUSEHOLD_COLLECTIONS]) {
    tables[name] = Object.fromEntries(((changes.put?.[name] ?? []) as { id: string }[]).map((record) => [record.id, record]));
  }
  return tables as unknown as Tables;
}

const lead = { billLeadDays: 7, expiryLeadDays: 5, maintenanceLeadDays: 7 };

describe('dashboard summary', () => {
  it('derives counts from records', () => {
    const data = tablesFromDemo();
    const today = todayIn('Asia/Kolkata');
    const summary = computeSummary(data, today, lead);
    const openTasks = Object.values(data.tasks).filter((task) => task.status !== 'completed').length;
    expect(summary.tasks.open).toBe(openTasks);
    expect(summary.tasks.overdue).toBeGreaterThanOrEqual(1);
    expect(summary.inventory.out).toBe(1); // Dish soap
    expect(summary.shopping.remaining).toBe(Object.values(data.shoppingItems).filter((item) => !item.purchased).length);
    const monthTotal = Object.values(data.expenses)
      .filter((expense) => expense.date.slice(0, 7) === today.slice(0, 7))
      .reduce((sum, expense) => sum + expense.amountMinor, 0);
    expect(summary.spending.monthMinor).toBe(monthTotal);
  });

  it('reports zeros for an empty household instead of inventing values', () => {
    const empty = Object.fromEntries([...GLOBAL_COLLECTIONS, ...HOUSEHOLD_COLLECTIONS].map((name) => [name, {}])) as unknown as Tables;
    const summary = computeSummary(empty, '2026-10-29', lead);
    expect(summary).toEqual({
      tasks: { open: 0, dueToday: 0, overdue: 0 },
      shopping: { remaining: 0, lists: 0 },
      bills: { attention: 0, overdue: 0, totalMinor: 0 },
      inventory: { low: 0, out: 0, expiring: 0 },
      spending: { monthMinor: 0, count: 0, budgetMinor: undefined },
      maintenance: { upcoming: 0, overdue: 0 },
    });
    expect(computeInsights(empty, '2026-10-29', 'INR', ['inventory', 'finance', 'tasks', 'maintenance'])).toEqual([]);
  });

  it('only produces insights for enabled modules', () => {
    const data = tablesFromDemo();
    const today = todayIn('Asia/Kolkata');
    const insights = computeInsights(data, today, 'INR', ['tasks']);
    expect(insights.every((insight) => insight.key === 'tasks-done')).toBe(true);
  });
});

describe('dashboard layout', () => {
  it('uses defaults and appends widgets missing from a saved layout', () => {
    expect(resolveWidgets(undefined)).toEqual(DEFAULT_WIDGETS);
    const saved = {
      id: 'u:h',
      householdId: 'h',
      userId: 'u',
      createdAt: '',
      updatedAt: '',
      widgets: [{ key: 'activity' as const, hidden: true, size: 'regular' as const }],
    };
    const resolved = resolveWidgets(saved);
    expect(resolved[0]).toEqual({ key: 'activity', hidden: true, size: 'regular' });
    expect(resolved).toHaveLength(DEFAULT_WIDGETS.length);
  });
});
