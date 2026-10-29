import { describe, expect, it } from 'vitest';
import dataReducer, { type Tables } from '@/store/dataSlice';
import type { Bill, BillOccurrence, CalendarEvent, MaintenanceTask, Task } from '@/types/models';
import { buildCalendarEntries, entriesOn, groupByDay } from '../aggregate';

const NOW = '2026-10-01T00:00:00.000Z';
const base = { householdId: 'h1', createdAt: NOW, updatedAt: NOW };

function tables(): Tables {
  // The reducer's initial state is frozen by Immer; tests need a mutable copy.
  return structuredClone(dataReducer(undefined, { type: 'init' }));
}

function event(fields: Partial<CalendarEvent>): CalendarEvent {
  return { id: 'e1', ...base, title: 'Event', category: 'household', date: '2026-10-10', allDay: true, memberIds: [], createdBy: 'u1', ...fields };
}

function task(fields: Partial<Task>): Task {
  return {
    id: 't1',
    ...base,
    title: 'Task',
    category: 'Cleaning',
    priority: 'medium',
    status: 'not_started',
    checklist: [],
    comments: [],
    boardOrder: 0,
    createdBy: 'u1',
    ...fields,
  };
}

describe('buildCalendarEntries', () => {
  it('shows each record once, linked to its source, without copying it', () => {
    const data = tables();
    data.tasks.t1 = task({ id: 't1', dueDate: '2026-10-12', assigneeId: 'u2' });
    const bill: Bill = { id: 'b1', ...base, name: 'Internet', category: 'Internet', amountMinor: 117900, startDate: '2026-10-12', active: true };
    data.bills.b1 = bill;
    const occurrence: BillOccurrence = { id: 'b1_2026-10-12', ...base, billId: 'b1', originalDate: '2026-10-12', dueDate: '2026-10-12', amountMinor: 117900, state: 'open' };
    data.billOccurrences[occurrence.id] = occurrence;
    const maintenance: MaintenanceTask = { id: 'm1', ...base, name: 'AC service', dueDate: '2026-10-12', priority: 'medium', status: 'scheduled', documentIds: [] };
    data.maintenanceTasks.m1 = maintenance;
    data.events.e1 = event({ date: '2026-10-12' });

    const entries = buildCalendarEntries(data, '2026-10-01', '2026-10-31', { today: '2026-10-05' });
    expect(entries.map((entry) => entry.key).sort()).toEqual(['bill:b1_2026-10-12', 'event:e1:2026-10-12', 'maintenance:m1', 'task:t1']);
    expect(new Set(entries.map((entry) => entry.key)).size).toBe(entries.length);
    expect(entries.find((entry) => entry.source === 'task')?.to).toBe('/tasks/t1');
    expect(entries.find((entry) => entry.source === 'bill')?.to).toBe('/finance/bills/b1_2026-10-12');
    expect(entries.find((entry) => entry.source === 'maintenance')?.to).toBe('/maintenance/tasks/m1');
    // The aggregation never adds calendar event records.
    expect(Object.keys(data.events)).toEqual(['e1']);
  });

  it('expands recurring events within the window', () => {
    const data = tables();
    data.events.e1 = event({ date: '2026-09-03', recurrence: { frequency: 'weekly', interval: 1 } });
    const dates = buildCalendarEntries(data, '2026-10-01', '2026-10-31').map((entry) => entry.date);
    expect(dates).toEqual(['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29']);
  });

  it('includes multi-day events that started before the window and spans every day', () => {
    const data = tables();
    data.events.e1 = event({ date: '2026-09-29', endDate: '2026-10-02' });
    const entries = buildCalendarEntries(data, '2026-10-01', '2026-10-31');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ date: '2026-09-29', endDate: '2026-10-02' });
    expect([...groupByDay(entries, '2026-10-01', '2026-10-31').keys()]).toEqual(['2026-10-01', '2026-10-02']);
    expect(entriesOn(entries, '2026-10-02')).toHaveLength(1);
    expect(entriesOn(entries, '2026-10-03')).toHaveLength(0);
  });

  it('excludes cancelled bill occurrences and respects source and member filters', () => {
    const data = tables();
    data.bills.b1 = { id: 'b1', ...base, name: 'Water', category: 'Water', amountMinor: 1000, startDate: '2026-10-05', active: true };
    data.billOccurrences.c = { id: 'c', ...base, billId: 'b1', originalDate: '2026-10-05', dueDate: '2026-10-05', amountMinor: 1000, state: 'cancelled' };
    data.tasks.t1 = task({ id: 't1', dueDate: '2026-10-06', assigneeId: 'u2' });
    data.tasks.t2 = task({ id: 't2', dueDate: '2026-10-07', assigneeId: 'u3' });
    data.events.e1 = event({ date: '2026-10-08', memberIds: [] });

    expect(buildCalendarEntries(data, '2026-10-01', '2026-10-31', { sources: ['bill'] })).toHaveLength(0);
    const forU2 = buildCalendarEntries(data, '2026-10-01', '2026-10-31', { memberId: 'u2' }).map((entry) => entry.key);
    // Whole-household events (no members) are shown for everyone.
    expect(forU2).toEqual(['task:t1', 'event:e1:2026-10-08']);
  });

  it('can leave out completed work', () => {
    const data = tables();
    data.tasks.t1 = task({ id: 't1', dueDate: '2026-10-06', status: 'completed' });
    expect(buildCalendarEntries(data, '2026-10-01', '2026-10-31', { includeCompleted: false })).toHaveLength(0);
    expect(buildCalendarEntries(data, '2026-10-01', '2026-10-31')[0]).toMatchObject({ done: true, statusLabel: 'Completed' });
  });
});
