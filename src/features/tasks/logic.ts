import type { ChangeSet } from '@/data/collections';
import type { ISODate, Priority, Task, TaskStatus } from '@/types/models';
import { addDaysISO, daysBetween } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { nextOccurrence } from '@/lib/recurrence';
import type { StatusTone } from '@/components/ui/StatusChip';

export type TaskDisplayStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';

export const TASK_STATUS_LABELS: Record<TaskDisplayStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  overdue: 'Overdue',
};

export const TASK_STATUS_TONES: Record<TaskDisplayStatus, StatusTone> = {
  not_started: 'neutral',
  in_progress: 'primary',
  completed: 'success',
  overdue: 'danger',
};

export const PRIORITY_LABELS: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };
export const PRIORITY_TONES: Record<Priority, StatusTone> = { high: 'terracotta', medium: 'warning', low: 'neutral' };
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export const BOARD_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'not_started', label: 'Not started' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'completed', label: 'Completed' },
];

export const REMINDER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'No reminder' },
  { value: '0', label: 'At the due time' },
  { value: '15', label: '15 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
];

export function reminderLabel(minutes: number | undefined): string | undefined {
  if (minutes === undefined) return undefined;
  return REMINDER_OPTIONS.find((option) => option.value === String(minutes))?.label ?? `${minutes} minutes before`;
}

/** Overdue is derived: an incomplete task whose due date is before today. */
export function isTaskOverdue(task: Pick<Task, 'status' | 'dueDate'>, today: ISODate): boolean {
  return task.status !== 'completed' && !!task.dueDate && task.dueDate < today;
}

export function displayStatus(task: Pick<Task, 'status' | 'dueDate'>, today: ISODate): TaskDisplayStatus {
  return isTaskOverdue(task, today) ? 'overdue' : task.status;
}

/* ------------------------------------------------------------------ */
/* Filtering & sorting                                                 */
/* ------------------------------------------------------------------ */

export type TaskStatusFilter = 'open' | 'overdue' | 'completed' | 'all';
export type TaskDueFilter = 'today' | 'week' | '';
export type TaskSort = 'due' | 'priority' | 'created' | 'title';

export interface TaskFilters {
  status: TaskStatusFilter;
  due: TaskDueFilter;
  /** A user id, `me`, `unassigned`, or empty for everyone. */
  assignee: string;
  priority: Priority | '';
  category: string;
  q: string;
}

export function filterTasks(tasks: Task[], filters: TaskFilters, today: ISODate, userId: string | undefined): Task[] {
  const query = filters.q.trim().toLowerCase();
  const weekEnd = addDaysISO(today, 6);
  return tasks.filter((task) => {
    if (filters.status === 'open' && task.status === 'completed') return false;
    if (filters.status === 'completed' && task.status !== 'completed') return false;
    if (filters.status === 'overdue' && !isTaskOverdue(task, today)) return false;
    if (filters.due === 'today' && task.dueDate !== today) return false;
    if (filters.due === 'week' && (!task.dueDate || task.dueDate < today || task.dueDate > weekEnd)) return false;
    if (filters.assignee === 'unassigned' && task.assigneeId) return false;
    if (filters.assignee === 'me' && task.assigneeId !== userId) return false;
    if (filters.assignee && !['me', 'unassigned'].includes(filters.assignee) && task.assigneeId !== filters.assignee) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.category && task.category !== filters.category) return false;
    if (query) {
      const haystack = [task.title, task.description, task.notes, task.category].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function compareDue(a: Task, b: Task): number {
  if (a.dueDate && b.dueDate) {
    return a.dueDate.localeCompare(b.dueDate) || (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99');
  }
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return 0;
}

export function sortTasks(tasks: Task[], sort: TaskSort): Task[] {
  const sorted = [...tasks];
  sorted.sort((a, b) => {
    switch (sort) {
      case 'priority':
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || compareDue(a, b) || a.title.localeCompare(b.title);
      case 'created':
        return b.createdAt.localeCompare(a.createdAt);
      case 'title':
        return a.title.localeCompare(b.title);
      case 'due':
      default:
        return compareDue(a, b) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.title.localeCompare(b.title);
    }
  });
  return sorted;
}

export type TaskGroupKey = 'overdue' | 'today' | 'upcoming' | 'someday' | 'completed';

export const TASK_GROUP_LABELS: Record<TaskGroupKey, string> = {
  overdue: 'Overdue',
  today: 'Today',
  upcoming: 'Upcoming',
  someday: 'No due date',
  completed: 'Completed',
};

export function taskGroup(task: Task, today: ISODate): TaskGroupKey {
  if (task.status === 'completed') return 'completed';
  if (!task.dueDate) return 'someday';
  if (task.dueDate < today) return 'overdue';
  if (task.dueDate === today) return 'today';
  return 'upcoming';
}

/** Groups tasks (already sorted) in a fixed, meaningful order; empty groups are omitted. */
export function groupTasks(tasks: Task[], today: ISODate): { key: TaskGroupKey; tasks: Task[] }[] {
  const order: TaskGroupKey[] = ['overdue', 'today', 'upcoming', 'someday', 'completed'];
  const groups = new Map<TaskGroupKey, Task[]>();
  for (const task of tasks) {
    const key = taskGroup(task, today);
    groups.set(key, [...(groups.get(key) ?? []), task]);
  }
  return order.flatMap((key) => {
    const list = groups.get(key);
    if (!list) return [];
    // Most recently completed first.
    if (key === 'completed') list.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    return [{ key, tasks: list }];
  });
}

/* ------------------------------------------------------------------ */
/* Recurrence                                                          */
/* ------------------------------------------------------------------ */

export function seriesIdOf(task: Pick<Task, 'id' | 'seriesId'>): string {
  return task.seriesId ?? task.id;
}

/** Deterministic id of the occurrence of a series due on `date`; re-generating it can never duplicate. */
export function occurrenceId(seriesId: string, date: ISODate): string {
  return `${seriesId}@${date}`;
}

/** The series' first known due date, used as the anchor so weekly/monthly patterns stay aligned. */
export function seriesAnchor(task: Task, allTasks: Iterable<Task>): ISODate | undefined {
  const seriesId = seriesIdOf(task);
  let anchor = task.dueDate;
  for (const other of allTasks) {
    if (seriesIdOf(other) !== seriesId || !other.dueDate) continue;
    if (!anchor || other.dueDate < anchor) anchor = other.dueDate;
  }
  return anchor;
}

/**
 * Due date of the occurrence that follows `task`. If the task was completed late, occurrences that
 * are already in the past are skipped so the household isn't handed a new overdue chore.
 */
export function nextDueDate(task: Task, anchor: ISODate | undefined, today: ISODate): ISODate | null {
  if (!task.recurrence) return null;
  const base = task.dueDate ?? today;
  const seriesAnchorDate = anchor ?? base;
  const next = nextOccurrence(task.recurrence, seriesAnchorDate, base);
  if (next && next < today) return nextOccurrence(task.recurrence, seriesAnchorDate, addDaysISO(today, -1));
  return next;
}

/** A fresh copy of `task` for the next occurrence (status, completion and comments reset). */
export function buildNextOccurrence(task: Task, dueDate: ISODate, now: string): Task {
  const seriesId = seriesIdOf(task);
  return {
    id: occurrenceId(seriesId, dueDate),
    householdId: task.householdId,
    title: task.title,
    description: task.description,
    category: task.category,
    assigneeId: task.assigneeId,
    dueDate,
    dueTime: task.dueTime,
    priority: task.priority,
    status: 'not_started',
    recurrence: task.recurrence,
    seriesId,
    checklist: task.checklist.map((item) => ({ id: newId(), text: item.text, done: false })),
    comments: [],
    notes: task.notes,
    reminderMinutesBefore: task.reminderMinutesBefore,
    boardOrder: task.boardOrder,
    createdBy: task.createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

export interface CompletionResult {
  changes: ChangeSet;
  completed: Task;
  /** The generated next occurrence, if one was created by this completion. */
  next?: Task;
}

/**
 * Change set for completing `task`. For recurring tasks the next occurrence is included unless
 * it already exists (deterministic id), so repeating the action never creates duplicates.
 */
export function buildCompletion(
  task: Task,
  tasks: Record<string, Task>,
  context: { today: ISODate; now: string; userId: string },
): CompletionResult {
  const completed: Task = {
    ...task,
    status: 'completed',
    completedAt: context.now,
    completedBy: context.userId,
    seriesId: task.recurrence ? seriesIdOf(task) : task.seriesId,
    updatedAt: context.now,
  };
  const put: Task[] = [completed];
  let next: Task | undefined;
  if (task.recurrence) {
    const due = nextDueDate(task, seriesAnchor(task, Object.values(tasks)), context.today);
    if (due) {
      const candidate = buildNextOccurrence(completed, due, context.now);
      if (!tasks[candidate.id] && candidate.id !== task.id) {
        next = candidate;
        put.push(candidate);
      }
    }
  }
  return { changes: { put: { tasks: put } }, completed, next };
}

/** Reopening never removes an already generated next occurrence. */
export function buildReopen(task: Task, now: string, status: Exclude<TaskStatus, 'completed'> = 'not_started'): Task {
  const { completedAt: _completedAt, completedBy: _completedBy, ...rest } = task;
  return { ...rest, status, updatedAt: now };
}

/** Days until (positive) or since (negative) the due date; `undefined` without a due date. */
export function dueInDays(task: Pick<Task, 'dueDate'>, today: ISODate): number | undefined {
  return task.dueDate ? daysBetween(today, task.dueDate) : undefined;
}

/* ------------------------------------------------------------------ */
/* Workload                                                            */
/* ------------------------------------------------------------------ */

export interface WorkloadRow {
  userId: string | null;
  open: number;
  overdue: number;
  completedRecently: number;
}

/** Per-member counts: open, overdue and completed within the last `days` days. */
export function computeWorkload(
  tasks: Task[],
  memberIds: string[],
  today: ISODate,
  timeZoneDate: (timestamp: string) => ISODate,
  days = 30,
): WorkloadRow[] {
  const since = addDaysISO(today, -(days - 1));
  const rows = new Map<string | null, WorkloadRow>();
  for (const id of memberIds) rows.set(id, { userId: id, open: 0, overdue: 0, completedRecently: 0 });
  const rowFor = (id: string | null) => {
    let row = rows.get(id);
    if (!row) {
      row = { userId: id, open: 0, overdue: 0, completedRecently: 0 };
      rows.set(id, row);
    }
    return row;
  };
  for (const task of tasks) {
    if (task.status === 'completed') {
      if (!task.completedAt) continue;
      const doneOn = timeZoneDate(task.completedAt);
      if (doneOn < since || doneOn > today) continue;
      rowFor(task.completedBy ?? task.assigneeId ?? null).completedRecently += 1;
    } else {
      const row = rowFor(task.assigneeId ?? null);
      row.open += 1;
      if (isTaskOverdue(task, today)) row.overdue += 1;
    }
  }
  return [...rows.values()].filter((row) => row.userId !== null || row.open > 0 || row.completedRecently > 0);
}
