import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfMonth,
} from 'date-fns';
import type { ISODate } from '@/types/models';

export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

export const COMMON_TIME_ZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
];

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function partsIn(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    time: `${get('hour')}:${get('minute')}`,
  };
}

/** Today's calendar date in the household time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): ISODate {
  return partsIn(timeZone, now).date;
}

/** Current hour (0–23) in the household time zone. */
export function hourIn(timeZone: string, now: Date = new Date()): number {
  return partsIn(timeZone, now).hour;
}

/** Current `HH:mm` in the household time zone. */
export function timeIn(timeZone: string, now: Date = new Date()): string {
  return partsIn(timeZone, now).time;
}

/** Converts a full timestamp into the household-local calendar date. */
export function isoDateInZone(timestamp: string, timeZone: string): ISODate {
  return partsIn(timeZone, new Date(timestamp)).date;
}

/** Parses a date-only string as a local calendar date (no time-zone shift). */
export function fromISODate(value: ISODate): Date {
  return parseISO(value);
}

export function toISODate(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd');
}

export function isISODate(value: unknown): value is ISODate {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));
}

export function addDaysISO(value: ISODate, days: number): ISODate {
  return toISODate(addDays(fromISODate(value), days));
}

export function addMonthsISO(value: ISODate, months: number): ISODate {
  return toISODate(addMonths(fromISODate(value), months));
}

/** Calendar days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return differenceInCalendarDays(fromISODate(to), fromISODate(from));
}

export function monthKey(value: ISODate): string {
  return value.slice(0, 7);
}

export function monthStart(value: ISODate): ISODate {
  return toISODate(startOfMonth(fromISODate(value)));
}

export function formatDate(value: ISODate, pattern = 'd MMM yyyy'): string {
  return format(fromISODate(value), pattern);
}

export function formatShortDate(value: ISODate): string {
  return format(fromISODate(value), 'd MMM');
}

/** Formats a `YYYY-MM` key as "Oct 2026". */
export function formatMonth(key: string): string {
  return format(fromISODate(`${key}-01`), 'MMM yyyy');
}

export function formatTimestamp(value: string, pattern = 'd MMM yyyy, h:mm a'): string {
  return format(new Date(value), pattern);
}

/** Formats `HH:mm` as a 12-hour time. */
export function formatTime(value: string): string {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return format(new Date(2000, 0, 1, hours, minutes), 'h:mm a');
}

/** Human label relative to `today`: "Today", "Tomorrow", "in 3 days", "2 days ago"… */
export function relativeDay(value: ISODate, today: ISODate): string {
  const diff = daysBetween(today, value);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `in ${diff} days`;
  if (diff < -1 && diff > -7) return `${-diff} days ago`;
  return formatDate(value, Math.abs(diff) < 300 ? 'd MMM' : 'd MMM yyyy');
}

/** Relative description of a past timestamp: "just now", "5 min ago", "3 h ago", or a date. */
export function timeAgo(timestamp: string, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return format(new Date(timestamp), 'd MMM yyyy');
}

export function greetingFor(hour: number): string {
  if (hour < 5) return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
