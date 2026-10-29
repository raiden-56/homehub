import { addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import type { ISODate } from '@/types/models';
import { addDaysISO, fromISODate, isISODate, toISODate } from '@/lib/dates';

export type CalendarView = 'month' | 'week' | 'agenda';

export const AGENDA_DAYS = 60;

export function parseView(value: string | null): CalendarView {
  return value === 'week' || value === 'agenda' ? value : 'month';
}

export function parseAnchor(value: string | null, today: ISODate): ISODate {
  return value && isISODate(value) ? value : today;
}

export function weekStart(date: ISODate): ISODate {
  return toISODate(startOfWeek(fromISODate(date)));
}

/** Visible date range for a view (month view includes the leading/trailing days of the grid). */
export function viewRange(view: CalendarView, anchor: ISODate): { from: ISODate; to: ISODate } {
  if (view === 'week') {
    const from = weekStart(anchor);
    return { from, to: addDaysISO(from, 6) };
  }
  if (view === 'agenda') return { from: anchor, to: addDaysISO(anchor, AGENDA_DAYS - 1) };
  const date = fromISODate(anchor);
  return { from: toISODate(startOfWeek(startOfMonth(date))), to: toISODate(endOfWeek(endOfMonth(date))) };
}

export function shiftAnchor(view: CalendarView, anchor: ISODate, direction: 1 | -1): ISODate {
  if (view === 'week') return addDaysISO(anchor, 7 * direction);
  if (view === 'agenda') return addDaysISO(anchor, AGENDA_DAYS * direction);
  return toISODate(addMonths(startOfMonth(fromISODate(anchor)), direction));
}

export function rangeTitle(view: CalendarView, anchor: ISODate): string {
  if (view === 'month') return format(fromISODate(anchor), 'MMMM yyyy');
  const { from, to } = viewRange(view, anchor);
  const start = fromISODate(from);
  const end = fromISODate(to);
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${format(start, sameYear ? 'd MMM' : 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`;
}

/** Weeks (arrays of 7 dates) covering the month that contains `anchor`. */
export function monthGrid(anchor: ISODate): ISODate[][] {
  const { from, to } = viewRange('month', anchor);
  const weeks: ISODate[][] = [];
  let day = from;
  while (day <= to) {
    const week: ISODate[] = [];
    for (let index = 0; index < 7; index += 1) {
      week.push(day);
      day = addDaysISO(day, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
