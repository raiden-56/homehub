import type { Tables } from '@/store/dataSlice';
import type { ISODate, Minor, NotificationPreferences } from '@/types/models';
import { addDaysISO, monthKey } from '@/lib/dates';
import { billStatus } from '@/features/finance/logic/bills';
import { expiryStatus, stockStatus } from '@/features/inventory/logic';
import { isTaskOverdue } from '@/features/tasks/logic';
import { maintenanceDueStatus } from '@/features/maintenance/logic';

export interface DashboardSummary {
  tasks: { open: number; dueToday: number; overdue: number };
  shopping: { remaining: number; lists: number };
  bills: { attention: number; overdue: number; totalMinor: Minor };
  inventory: { low: number; out: number; expiring: number };
  spending: { monthMinor: Minor; count: number; budgetMinor?: Minor };
  maintenance: { upcoming: number; overdue: number };
}

type LeadDays = Pick<NotificationPreferences, 'billLeadDays' | 'expiryLeadDays' | 'maintenanceLeadDays'>;

/** Counts behind the dashboard summary cards — all derived from stored records, nothing estimated. */
export function computeSummary(data: Tables, today: ISODate, lead: LeadDays): DashboardSummary {
  const tasks = Object.values(data.tasks).filter((task) => task.status !== 'completed');
  const activeLists = new Set(
    Object.values(data.shoppingLists)
      .filter((list) => !list.archived)
      .map((list) => list.id),
  );
  const pendingShopping = Object.values(data.shoppingItems).filter(
    (item) => activeLists.has(item.listId) && !item.purchased && !item.clearedAt,
  );

  let billAttention = 0;
  let billOverdue = 0;
  let billTotal = 0;
  for (const occurrence of Object.values(data.billOccurrences)) {
    const status = billStatus(occurrence, today, lead.billLeadDays);
    if (status === 'overdue' || status === 'due-soon') {
      billAttention += 1;
      billTotal += occurrence.amountMinor;
      if (status === 'overdue') billOverdue += 1;
    }
  }

  let low = 0;
  let out = 0;
  let expiring = 0;
  for (const item of Object.values(data.inventoryItems)) {
    if (item.archived) continue;
    const stock = stockStatus(item);
    if (stock === 'low') low += 1;
    if (stock === 'out') out += 1;
    const expiry = expiryStatus(item, today, lead.expiryLeadDays);
    if ((expiry === 'soon' || expiry === 'expired') && item.quantity > 0) expiring += 1;
  }

  const month = monthKey(today);
  const monthExpenses = Object.values(data.expenses).filter((expense) => monthKey(expense.date) === month);
  const budget = Object.values(data.budgets)[0];

  let maintenanceUpcoming = 0;
  let maintenanceOverdue = 0;
  const horizon = addDaysISO(today, Math.max(lead.maintenanceLeadDays, 14));
  for (const task of Object.values(data.maintenanceTasks)) {
    const status = maintenanceDueStatus(task, today, lead.maintenanceLeadDays);
    if (status === 'overdue') maintenanceOverdue += 1;
    else if (status !== 'completed' && status !== 'cancelled' && task.dueDate <= horizon) maintenanceUpcoming += 1;
  }

  return {
    tasks: {
      open: tasks.length,
      dueToday: tasks.filter((task) => task.dueDate === today).length,
      overdue: tasks.filter((task) => isTaskOverdue(task, today)).length,
    },
    shopping: {
      remaining: pendingShopping.length,
      lists: new Set(pendingShopping.map((item) => item.listId)).size,
    },
    bills: { attention: billAttention, overdue: billOverdue, totalMinor: billTotal },
    inventory: { low, out, expiring },
    spending: {
      monthMinor: monthExpenses.reduce((sum, expense) => sum + expense.amountMinor, 0),
      count: monthExpenses.length,
      budgetMinor: budget?.overallMinor,
    },
    maintenance: { upcoming: maintenanceUpcoming, overdue: maintenanceOverdue },
  };
}
