import { CalendarDays, CheckSquare, Receipt, Wrench, type LucideIcon } from 'lucide-react';
import type { EventCategory } from '@/types/models';
import type { ModeTokens } from '@/theme/tokens';

export type CalendarSource = 'event' | 'task' | 'bill' | 'maintenance';

export const CALENDAR_SOURCES: CalendarSource[] = ['event', 'task', 'bill', 'maintenance'];

export const SOURCE_INFO: Record<CalendarSource, { label: string; plural: string; icon: LucideIcon }> = {
  event: { label: 'Event', plural: 'Events', icon: CalendarDays },
  task: { label: 'Task', plural: 'Tasks', icon: CheckSquare },
  bill: { label: 'Bill', plural: 'Bills', icon: Receipt },
  maintenance: { label: 'Maintenance', plural: 'Maintenance', icon: Wrench },
};

/** Accent colours per source. Always paired with an icon and a text label. */
export function sourceColors(tokens: ModeTokens): Record<CalendarSource, { accent: string; soft: string; text: string }> {
  return {
    event: { accent: tokens.primary, soft: tokens.sage, text: tokens.sageText },
    task: { accent: tokens.amber, soft: tokens.amberSoft, text: tokens.amberText },
    bill: { accent: tokens.terracotta, soft: tokens.terracottaSoft, text: tokens.terracottaText },
    maintenance: { accent: tokens.success, soft: tokens.successSoft, text: tokens.successText },
  };
}

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  household: 'Household',
  appointment: 'Appointment',
  social: 'Social',
  reminder: 'Reminder',
  other: 'Other',
};
