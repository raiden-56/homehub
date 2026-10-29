import { describe, expect, it } from 'vitest';
import type { Task } from '@/types/models';
import {
  buildCompletion,
  computeWorkload,
  displayStatus,
  filterTasks,
  groupTasks,
  isTaskOverdue,
  nextDueDate,
  occurrenceId,
  sortTasks,
  type TaskFilters,
} from '../logic';

const NOW = '2026-10-29T06:00:00.000Z';

function task(fields: Partial<Task> = {}): Task {
  return {
    id: fields.id ?? `t-${Math.random().toString(36).slice(2)}`,
    householdId: 'h1',
    title: 'Clean kitchen',
    category: 'Cleaning',
    priority: 'medium',
    status: 'not_started',
    checklist: [],
    comments: [],
    boardOrder: 0,
    createdBy: 'u1',
    createdAt: NOW,
    updatedAt: NOW,
    ...fields,
  };
}

const ALL: TaskFilters = { status: 'all', due: '', assignee: '', priority: '', category: '', q: '' };

describe('overdue derivation', () => {
  it('is overdue only when incomplete and due before today', () => {
    expect(isTaskOverdue(task({ dueDate: '2026-10-28' }), '2026-10-29')).toBe(true);
    expect(isTaskOverdue(task({ dueDate: '2026-10-29' }), '2026-10-29')).toBe(false);
    expect(isTaskOverdue(task({ dueDate: '2026-10-20', status: 'completed' }), '2026-10-29')).toBe(false);
    expect(isTaskOverdue(task({}), '2026-10-29')).toBe(false);
  });

  it('never stores overdue — it is a display status on top of the stored one', () => {
    const late = task({ dueDate: '2026-10-01', status: 'in_progress' });
    expect(displayStatus(late, '2026-10-29')).toBe('overdue');
    expect(late.status).toBe('in_progress');
  });
});

describe('next occurrence', () => {
  it('daily: completing late skips to today instead of creating an overdue chore', () => {
    const daily = task({ dueDate: '2026-10-26', recurrence: { frequency: 'daily', interval: 1 } });
    expect(nextDueDate(daily, '2026-10-26', '2026-10-29')).toBe('2026-10-29');
  });

  it('weekly on chosen weekdays follows the pattern', () => {
    const weekly = task({ dueDate: '2026-10-29', recurrence: { frequency: 'weekly', interval: 1, byWeekday: [1, 4] } });
    expect(nextDueDate(weekly, '2026-10-26', '2026-10-29')).toBe('2026-11-02');
  });

  it('monthly series anchored on the 31st returns to the end of the month', () => {
    const monthly = task({ dueDate: '2026-02-28', recurrence: { frequency: 'monthly', interval: 1 } });
    expect(nextDueDate(monthly, '2026-01-31', '2026-02-28')).toBe('2026-03-31');
  });

  it('returns null when the series has ended', () => {
    const ending = task({ dueDate: '2026-10-29', recurrence: { frequency: 'daily', interval: 1, until: '2026-10-29' } });
    expect(nextDueDate(ending, '2026-10-01', '2026-10-29')).toBeNull();
  });
});

describe('buildCompletion', () => {
  it('completes a one-off task without creating anything else', () => {
    const once = task({ id: 'a', dueDate: '2026-10-29' });
    const result = buildCompletion(once, { a: once }, { today: '2026-10-29', now: NOW, userId: 'u2' });
    expect(result.next).toBeUndefined();
    expect(result.completed).toMatchObject({ status: 'completed', completedBy: 'u2', completedAt: NOW });
    expect(result.changes.put?.tasks).toHaveLength(1);
  });

  it('creates the next occurrence with a deterministic id and reset state', () => {
    const recurring = task({
      id: 'r1',
      dueDate: '2026-10-29',
      recurrence: { frequency: 'weekly', interval: 1 },
      checklist: [{ id: 'c1', text: 'Wipe counters', done: true }],
      comments: [{ id: 'm1', authorId: 'u1', text: 'Done!', createdAt: NOW }],
    });
    const result = buildCompletion(recurring, { r1: recurring }, { today: '2026-10-29', now: NOW, userId: 'u1' });
    expect(result.completed.seriesId).toBe('r1');
    expect(result.next).toMatchObject({
      id: occurrenceId('r1', '2026-11-05'),
      seriesId: 'r1',
      dueDate: '2026-11-05',
      status: 'not_started',
      comments: [],
    });
    expect(result.next?.checklist).toEqual([expect.objectContaining({ text: 'Wipe counters', done: false })]);
    expect(result.next?.completedAt).toBeUndefined();
  });

  it('does not recreate a next occurrence that already exists', () => {
    const recurring = task({ id: 'r1', dueDate: '2026-10-29', recurrence: { frequency: 'weekly', interval: 1 } });
    const existing = task({ id: occurrenceId('r1', '2026-11-05'), seriesId: 'r1', dueDate: '2026-11-05' });
    const result = buildCompletion(recurring, { r1: recurring, [existing.id]: existing }, { today: '2026-10-29', now: NOW, userId: 'u1' });
    expect(result.next).toBeUndefined();
    expect(result.changes.put?.tasks).toHaveLength(1);
  });
});

describe('filtering, sorting and grouping', () => {
  const today = '2026-10-29';
  const tasks = [
    task({ id: '1', title: 'Water plants', dueDate: '2026-10-29', assigneeId: 'u1', priority: 'low' }),
    task({ id: '2', title: 'Pay plumber', dueDate: '2026-10-27', priority: 'high' }),
    task({ id: '3', title: 'Sort recycling', dueDate: '2026-11-02', assigneeId: 'u2', category: 'Errands' }),
    task({ id: '4', title: 'Vacuum', status: 'completed', completedAt: NOW }),
    task({ id: '5', title: 'Fix shelf', description: 'Needs wall plugs' }),
  ];

  it('filters by status, due, assignee and search text', () => {
    const ids = (filters: Partial<TaskFilters>) => filterTasks(tasks, { ...ALL, ...filters }, today, 'u1').map((entry) => entry.id);
    expect(ids({ status: 'open' })).toEqual(['1', '2', '3', '5']);
    expect(ids({ status: 'overdue' })).toEqual(['2']);
    expect(ids({ status: 'completed' })).toEqual(['4']);
    expect(ids({ due: 'today' })).toEqual(['1']);
    expect(ids({ due: 'week' })).toEqual(['1', '3']);
    expect(ids({ assignee: 'me' })).toEqual(['1']);
    expect(ids({ assignee: 'unassigned' })).toEqual(['2', '4', '5']);
    expect(ids({ q: 'wall' })).toEqual(['5']);
    expect(ids({ category: 'Errands' })).toEqual(['3']);
  });

  it('sorts by due date (undated last) and by priority', () => {
    expect(sortTasks(tasks, 'due').map((entry) => entry.id).slice(0, 3)).toEqual(['2', '1', '3']);
    expect(sortTasks(tasks, 'priority')[0]?.id).toBe('2');
  });

  it('groups into overdue, today, upcoming, no date and completed', () => {
    expect(groupTasks(sortTasks(tasks, 'due'), today).map((group) => group.key)).toEqual([
      'overdue',
      'today',
      'upcoming',
      'someday',
      'completed',
    ]);
  });
});

describe('computeWorkload', () => {
  it('counts open, overdue and recently completed tasks per member', () => {
    const rows = computeWorkload(
      [
        task({ assigneeId: 'u1', dueDate: '2026-10-20' }),
        task({ assigneeId: 'u1', dueDate: '2026-11-20' }),
        task({ assigneeId: 'u2', status: 'completed', completedBy: 'u2', completedAt: '2026-10-25T10:00:00.000Z' }),
        task({ assigneeId: 'u2', status: 'completed', completedBy: 'u2', completedAt: '2026-08-01T10:00:00.000Z' }),
        task({}),
      ],
      ['u1', 'u2'],
      '2026-10-29',
      (timestamp) => timestamp.slice(0, 10),
    );
    expect(rows).toEqual([
      { userId: 'u1', open: 2, overdue: 1, completedRecently: 0 },
      { userId: 'u2', open: 0, overdue: 0, completedRecently: 1 },
      { userId: null, open: 1, overdue: 0, completedRecently: 0 },
    ]);
  });
});
