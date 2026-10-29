import type { DashboardLayout, DashboardWidgetConfig, DashboardWidgetKey, ModuleKey } from '@/types/models';

export const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
  { key: 'tasks', hidden: false, size: 'regular' },
  { key: 'bills', hidden: false, size: 'regular' },
  { key: 'inventory', hidden: false, size: 'regular' },
  { key: 'shopping', hidden: false, size: 'regular' },
  { key: 'spending', hidden: false, size: 'wide' },
  { key: 'maintenance', hidden: false, size: 'regular' },
  { key: 'insights', hidden: false, size: 'regular' },
  { key: 'activity', hidden: false, size: 'wide' },
];

/** Module a widget depends on; widgets for hidden modules are not shown. */
export const WIDGET_MODULE: Partial<Record<DashboardWidgetKey, ModuleKey>> = {
  tasks: 'tasks',
  bills: 'finance',
  spending: 'finance',
  inventory: 'inventory',
  shopping: 'shopping',
  maintenance: 'maintenance',
};

export const WIDGET_TITLES: Record<DashboardWidgetKey, string> = {
  tasks: 'Today’s tasks',
  bills: 'Bills due soon',
  inventory: 'Inventory alerts',
  shopping: 'Shopping overview',
  spending: 'Household spending',
  maintenance: 'Maintenance schedule',
  insights: 'Household insights',
  activity: 'Recent activity',
};

export function layoutId(userId: string, householdId: string): string {
  return `${userId}:${householdId}`;
}

/**
 * Normalises a saved layout against the current widget set: unknown widgets are dropped and
 * widgets added in newer versions are appended with their defaults.
 */
export function resolveWidgets(saved: DashboardLayout | undefined): DashboardWidgetConfig[] {
  if (!saved) return DEFAULT_WIDGETS.map((widget) => ({ ...widget }));
  const known = new Set(DEFAULT_WIDGETS.map((widget) => widget.key));
  const result = saved.widgets.filter((widget) => known.has(widget.key));
  for (const widget of DEFAULT_WIDGETS) {
    if (!result.some((entry) => entry.key === widget.key)) result.push({ ...widget });
  }
  return result;
}
