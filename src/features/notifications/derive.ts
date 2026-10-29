import type { Tables } from '@/store/dataSlice';
import type { NotificationCategory, NotificationPreferences, Role } from '@/types/models';
import { paths } from '@/app/paths';
import { daysBetween, formatDate, relativeDay } from '@/lib/dates';
import { billStatus } from '@/features/finance/logic/bills';
import { expiryStatus, stockStatus } from '@/features/inventory/logic';
import { isTaskOverdue } from '@/features/tasks/logic';
import { maintenanceDueStatus, warrantyStatus } from '@/features/maintenance/logic';

export interface AppNotification {
  /** Stable key; changes when the underlying situation changes so it becomes unread again. */
  key: string;
  category: NotificationCategory;
  severity: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  to: string;
  /** Date the notification relates to, used for ordering. */
  date: string;
}

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  bills: 'Upcoming & overdue bills',
  tasks: 'Overdue tasks',
  inventory: 'Low inventory',
  expiry: 'Expiring products',
  maintenance: 'Upcoming maintenance',
  warranty: 'Warranty expiry',
  invitations: 'Household invitations',
};

interface DeriveInput {
  data: Tables;
  today: string;
  userId: string;
  role: Role | undefined;
  preferences: NotificationPreferences;
  enabledModules: string[];
}

/**
 * Builds the in-app notification list from current household data. Nothing is "sent": these are
 * computed reminders shown inside HomeHub only.
 */
export function deriveNotifications({ data, today, userId, role, preferences, enabledModules }: DeriveInput): AppNotification[] {
  const out: AppNotification[] = [];
  const on = (category: NotificationCategory, module?: string) =>
    preferences.enabled[category] && (!module || enabledModules.includes(module));

  if (on('bills', 'finance')) {
    for (const occurrence of Object.values(data.billOccurrences)) {
      const bill = data.bills[occurrence.billId];
      if (!bill) continue;
      const status = billStatus(occurrence, today, preferences.billLeadDays);
      if (status === 'overdue') {
        out.push({
          key: `bill-overdue:${occurrence.id}`,
          category: 'bills',
          severity: 'danger',
          title: `${bill.name} is overdue`,
          description: `Was due ${relativeDay(occurrence.dueDate, today).toLowerCase()} (${formatDate(occurrence.dueDate, 'd MMM')}).`,
          to: paths.billOccurrence(occurrence.id),
          date: occurrence.dueDate,
        });
      } else if (status === 'due-soon') {
        out.push({
          key: `bill-due:${occurrence.id}`,
          category: 'bills',
          severity: 'warning',
          title: `${bill.name} due ${relativeDay(occurrence.dueDate, today).toLowerCase()}`,
          description: `Due on ${formatDate(occurrence.dueDate, 'EEE d MMM')}.`,
          to: paths.billOccurrence(occurrence.id),
          date: occurrence.dueDate,
        });
      }
    }
  }

  if (on('tasks', 'tasks')) {
    for (const task of Object.values(data.tasks)) {
      if (task.assigneeId && task.assigneeId !== userId) continue;
      if (isTaskOverdue(task, today)) {
        out.push({
          key: `task-overdue:${task.id}`,
          category: 'tasks',
          severity: 'danger',
          title: `“${task.title}” is overdue`,
          description: task.assigneeId ? `Assigned to you · due ${formatDate(task.dueDate!, 'd MMM')}` : `Unassigned · due ${formatDate(task.dueDate!, 'd MMM')}`,
          to: paths.task(task.id),
          date: task.dueDate!,
        });
      }
    }
  }

  if (on('inventory', 'inventory') || on('expiry', 'inventory')) {
    for (const item of Object.values(data.inventoryItems)) {
      if (item.archived) continue;
      const stock = stockStatus(item);
      if (on('inventory', 'inventory') && stock !== 'ok') {
        out.push({
          key: `stock-${stock}:${item.id}`,
          category: 'inventory',
          severity: stock === 'out' ? 'danger' : 'warning',
          title: stock === 'out' ? `${item.name} is out of stock` : `${item.name} is running low`,
          description: `${item.quantity} ${item.unit} left (minimum ${item.minQuantity}).`,
          to: paths.inventoryItem(item.id),
          date: today,
        });
      }
      const expiry = expiryStatus(item, today, preferences.expiryLeadDays);
      if (on('expiry', 'inventory') && (expiry === 'expired' || expiry === 'soon') && item.quantity > 0) {
        out.push({
          key: `expiry-${expiry}:${item.id}:${item.expiryDate}`,
          category: 'expiry',
          severity: expiry === 'expired' ? 'danger' : 'warning',
          title: expiry === 'expired' ? `${item.name} has expired` : `${item.name} expires ${relativeDay(item.expiryDate!, today).toLowerCase()}`,
          description: `Expiry date ${formatDate(item.expiryDate!, 'd MMM yyyy')}.`,
          to: paths.inventoryItem(item.id),
          date: item.expiryDate!,
        });
      }
    }
  }

  if (on('maintenance', 'maintenance')) {
    for (const task of Object.values(data.maintenanceTasks)) {
      const status = maintenanceDueStatus(task, today, preferences.maintenanceLeadDays);
      if (status !== 'overdue' && status !== 'due-soon') continue;
      const asset = task.assetId ? data.assets[task.assetId]?.name : undefined;
      out.push({
        key: `maintenance-${status}:${task.id}`,
        category: 'maintenance',
        severity: status === 'overdue' ? 'danger' : 'warning',
        title: status === 'overdue' ? `${task.name} is overdue` : `${task.name} due ${relativeDay(task.dueDate, today).toLowerCase()}`,
        description: [asset, formatDate(task.dueDate, 'EEE d MMM')].filter(Boolean).join(' · '),
        to: paths.maintenanceTask(task.id),
        date: task.dueDate,
      });
    }
  }

  if (on('warranty', 'maintenance')) {
    for (const asset of Object.values(data.assets)) {
      if (asset.archived) continue;
      const status = warrantyStatus(asset, today, preferences.warrantyLeadDays);
      if (status !== 'expiring') continue;
      out.push({
        key: `warranty:${asset.id}:${asset.warrantyExpiry}`,
        category: 'warranty',
        severity: 'warning',
        title: `${asset.name} warranty ends ${relativeDay(asset.warrantyExpiry!, today).toLowerCase()}`,
        description: `Expires ${formatDate(asset.warrantyExpiry!, 'd MMM yyyy')} — book any covered repairs before then.`,
        to: paths.asset(asset.id),
        date: asset.warrantyExpiry!,
      });
    }
  }

  if (on('invitations') && (role === 'owner' || role === 'admin')) {
    for (const invitation of Object.values(data.invitations)) {
      const householdName = data.households[invitation.householdId]?.name;
      if (!householdName) continue;
      if (invitation.status === 'accepted' && invitation.acceptedAt && invitation.acceptedBy) {
        const accepted = invitation.acceptedAt.slice(0, 10);
        if (daysBetween(accepted, today) > 14) continue;
        const name = data.users[invitation.acceptedBy]?.name ?? 'Someone';
        out.push({
          key: `invite-accepted:${invitation.id}`,
          category: 'invitations',
          severity: 'info',
          title: `${name} joined ${householdName}`,
          description: 'They accepted your invitation.',
          to: paths.members(),
          date: accepted,
        });
      } else if (invitation.status === 'pending') {
        const hoursLeft = (new Date(invitation.expiresAt).getTime() - Date.now()) / 3_600_000;
        if (hoursLeft > 0 && hoursLeft <= 24) {
          out.push({
            key: `invite-expiring:${invitation.id}`,
            category: 'invitations',
            severity: 'info',
            title: 'An invitation expires soon',
            description: `${invitation.label ?? 'Invite link'} expires within 24 hours.`,
            to: paths.members(),
            date: today,
          });
        }
      }
    }
  }

  const severityRank = { danger: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.date.localeCompare(b.date));
}
