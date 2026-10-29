import { describe, expect, it } from 'vitest';
import { deriveNotifications } from '../derive';
import { buildDemoHousehold } from '@/features/household/demo';
import { defaultPreferences } from '@/features/household/factory';
import { GLOBAL_COLLECTIONS, HOUSEHOLD_COLLECTIONS } from '@/data/collections';
import type { Tables } from '@/store/dataSlice';
import { todayIn } from '@/lib/dates';
import { MODULE_KEYS } from '@/types/models';

function demoTables() {
  const { changes } = buildDemoHousehold('owner-1');
  const tables: Record<string, Record<string, { id: string }>> = {};
  for (const name of [...GLOBAL_COLLECTIONS, ...HOUSEHOLD_COLLECTIONS]) {
    tables[name] = Object.fromEntries(((changes.put?.[name] ?? []) as { id: string }[]).map((record) => [record.id, record]));
  }
  return tables as unknown as Tables;
}

describe('deriveNotifications', () => {
  const today = todayIn('Asia/Kolkata');
  const preferences = defaultPreferences('owner-1', '').notifications;

  it('derives reminders from real data across modules', () => {
    const notifications = deriveNotifications({
      data: demoTables(),
      today,
      userId: 'owner-1',
      role: 'owner',
      preferences,
      enabledModules: [...MODULE_KEYS],
    });
    const categories = new Set(notifications.map((notification) => notification.category));
    expect(categories).toEqual(new Set(['bills', 'tasks', 'inventory', 'expiry', 'maintenance', 'warranty']));
    // Danger first.
    expect(notifications[0]!.severity).toBe('danger');
    // Keys are unique so read state can't collide.
    expect(new Set(notifications.map((notification) => notification.key)).size).toBe(notifications.length);
  });

  it('respects disabled categories and hidden modules', () => {
    const notifications = deriveNotifications({
      data: demoTables(),
      today,
      userId: 'owner-1',
      role: 'owner',
      preferences: { ...preferences, enabled: { ...preferences.enabled, bills: false } },
      enabledModules: ['tasks'],
    });
    expect(notifications.every((notification) => notification.category === 'tasks')).toBe(true);
  });

  it('only shows overdue tasks assigned to the member or unassigned', () => {
    const data = demoTables();
    const notifications = deriveNotifications({ data, today, userId: 'nobody', role: 'member', preferences, enabledModules: ['tasks'] });
    for (const notification of notifications) {
      const task = Object.values(data.tasks).find((entry) => notification.key.endsWith(entry.id));
      expect(task?.assigneeId === undefined || task?.assigneeId === 'nobody').toBe(true);
    }
  });
});
