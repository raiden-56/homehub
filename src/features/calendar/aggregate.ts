import { useMemo } from 'react';
import { useAppSelector, useToday } from '@/app/hooks';
import { paths } from '@/app/paths';
import type { Tables } from '@/store/dataSlice';
import type { ISODate } from '@/types/models';
import type { StatusTone } from '@/components/ui/StatusChip';
import { addDaysISO, daysBetween } from '@/lib/dates';
import { occurrencesBetween } from '@/lib/recurrence';
import { BILL_STATUS_LABELS, billStatus } from '@/features/finance/logic/bills';
import { MAINTENANCE_STATUS_LABELS, maintenanceDueStatus } from '@/features/maintenance/logic';
import { PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_STATUS_TONES, displayStatus } from '@/features/tasks/logic';
import { EVENT_CATEGORY_LABELS, type CalendarSource } from './sources';

export type { CalendarSource } from './sources';

/**
 * A read-only view of something scheduled on the calendar. Entries are derived from the
 * underlying records each time — the calendar never stores copies of tasks, bills or services.
 */
export interface CalendarEntry {
  key: string;
  source: CalendarSource;
  recordId: string;
  title: string;
  /** Start date (for recurring events, this occurrence's date). */
  date: ISODate;
  /** Inclusive last day for multi-day entries. */
  endDate?: ISODate;
  time?: string;
  endTime?: string;
  allDay: boolean;
  memberIds: string[];
  category: string;
  statusLabel?: string;
  tone: StatusTone;
  /** Link to the record this entry represents. */
  to: string;
  done: boolean;
  location?: string;
  detail?: string;
}

export interface CalendarOptions {
  sources?: CalendarSource[];
  /** Only entries involving this member (events without members count as whole-household). */
  memberId?: string;
  includeCompleted?: boolean;
  /** Used to derive overdue/due-soon labels; defaults to `from`. */
  today?: ISODate;
}

function inRange(date: ISODate, from: ISODate, to: ISODate): boolean {
  return date >= from && date <= to;
}

export function buildCalendarEntries(data: Tables, from: ISODate, to: ISODate, options: CalendarOptions = {}): CalendarEntry[] {
  const sources = new Set(options.sources ?? ['event', 'task', 'bill', 'maintenance']);
  const includeCompleted = options.includeCompleted ?? true;
  const today = options.today ?? from;
  const entries: CalendarEntry[] = [];

  if (sources.has('event')) {
    for (const event of Object.values(data.events)) {
      const span = event.endDate && event.endDate > event.date ? daysBetween(event.date, event.endDate) : 0;
      const starts = event.recurrence
        ? occurrencesBetween(event.recurrence, event.date, addDaysISO(from, -span), to)
        : [event.date];
      for (const start of starts) {
        const end = span > 0 ? addDaysISO(start, span) : start;
        if (end < from || start > to) continue;
        entries.push({
          key: `event:${event.id}:${start}`,
          source: 'event',
          recordId: event.id,
          title: event.title,
          date: start,
          endDate: span > 0 ? end : undefined,
          time: event.allDay ? undefined : event.startTime,
          endTime: event.allDay ? undefined : event.endTime,
          allDay: event.allDay || !event.startTime,
          memberIds: event.memberIds,
          category: EVENT_CATEGORY_LABELS[event.category],
          tone: 'primary',
          to: paths.calendarEvent(event.id),
          done: false,
          location: event.location,
        });
      }
    }
  }

  if (sources.has('task')) {
    for (const task of Object.values(data.tasks)) {
      if (!task.dueDate || !inRange(task.dueDate, from, to)) continue;
      if (!includeCompleted && task.status === 'completed') continue;
      const status = displayStatus(task, today);
      entries.push({
        key: `task:${task.id}`,
        source: 'task',
        recordId: task.id,
        title: task.title,
        date: task.dueDate,
        time: task.dueTime,
        allDay: !task.dueTime,
        memberIds: task.assigneeId ? [task.assigneeId] : [],
        category: task.category,
        statusLabel: TASK_STATUS_LABELS[status],
        tone: TASK_STATUS_TONES[status],
        to: paths.task(task.id),
        done: task.status === 'completed',
        detail: `${PRIORITY_LABELS[task.priority]} priority`,
      });
    }
  }

  if (sources.has('bill')) {
    for (const occurrence of Object.values(data.billOccurrences)) {
      if (occurrence.state === 'cancelled' || !inRange(occurrence.dueDate, from, to)) continue;
      if (!includeCompleted && occurrence.state === 'paid') continue;
      const bill = data.bills[occurrence.billId];
      if (!bill) continue;
      const status = billStatus(occurrence, today);
      const payer = occurrence.paidBy ?? bill.payerId;
      entries.push({
        key: `bill:${occurrence.id}`,
        source: 'bill',
        recordId: occurrence.id,
        title: bill.name,
        date: occurrence.dueDate,
        allDay: true,
        memberIds: payer ? [payer] : [],
        category: bill.category,
        statusLabel: BILL_STATUS_LABELS[status],
        tone: status === 'paid' ? 'success' : status === 'overdue' ? 'danger' : status === 'due-soon' ? 'warning' : 'neutral',
        to: paths.billOccurrence(occurrence.id),
        done: occurrence.state === 'paid',
      });
    }
  }

  if (sources.has('maintenance')) {
    for (const task of Object.values(data.maintenanceTasks)) {
      if (task.status === 'cancelled' || !inRange(task.dueDate, from, to)) continue;
      if (task.status === 'completed' && !includeCompleted) continue;
      const status = maintenanceDueStatus(task, today);
      const asset = task.assetId ? data.assets[task.assetId] : undefined;
      entries.push({
        key: `maintenance:${task.id}`,
        source: 'maintenance',
        recordId: task.id,
        title: task.name,
        date: task.dueDate,
        allDay: true,
        memberIds: task.assigneeId ? [task.assigneeId] : [],
        category: asset?.name ?? 'Home maintenance',
        statusLabel: MAINTENANCE_STATUS_LABELS[status],
        tone: status === 'completed' ? 'success' : status === 'overdue' ? 'danger' : status === 'due-soon' ? 'warning' : 'neutral',
        to: paths.maintenanceTask(task.id),
        done: task.status === 'completed',
        detail: task.provider,
      });
    }
  }

  const filtered = options.memberId
    ? entries.filter(
        (entry) =>
          entry.memberIds.includes(options.memberId!) || (entry.source === 'event' && entry.memberIds.length === 0),
      )
    : entries;

  return filtered.sort(compareEntries);
}

export function compareEntries(a: CalendarEntry, b: CalendarEntry): number {
  return (
    a.date.localeCompare(b.date) ||
    Number(b.allDay) - Number(a.allDay) ||
    (a.time ?? '').localeCompare(b.time ?? '') ||
    a.title.localeCompare(b.title)
  );
}

/** Entries shown on `date`, including multi-day entries that span it. */
export function entriesOn(entries: CalendarEntry[], date: ISODate): CalendarEntry[] {
  return entries.filter((entry) => entry.date === date || (entry.endDate !== undefined && entry.date <= date && entry.endDate >= date));
}

/** Groups entries by every day they cover within [from, to]. */
export function groupByDay(entries: CalendarEntry[], from: ISODate, to: ISODate): Map<ISODate, CalendarEntry[]> {
  const map = new Map<ISODate, CalendarEntry[]>();
  for (const entry of entries) {
    const last = entry.endDate ?? entry.date;
    let day = entry.date < from ? from : entry.date;
    while (day <= last && day <= to) {
      map.set(day, [...(map.get(day) ?? []), entry]);
      day = addDaysISO(day, 1);
    }
  }
  for (const list of map.values()) list.sort(compareEntries);
  return map;
}

export function useCalendarEntries(from: ISODate, to: ISODate, options: Omit<CalendarOptions, 'today'> = {}): CalendarEntry[] {
  const data = useAppSelector((state) => state.data);
  const today = useToday();
  const { sources, memberId, includeCompleted } = options;
  const sourceKey = sources?.join(',');
  return useMemo(
    () => buildCalendarEntries(data, from, to, { sources: sourceKey ? (sourceKey.split(',') as CalendarSource[]) : undefined, memberId, includeCompleted, today }),
    [data, from, to, sourceKey, memberId, includeCompleted, today],
  );
}
