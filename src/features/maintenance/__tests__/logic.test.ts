import { describe, expect, it } from 'vitest';
import type { MaintenanceTask } from '@/types/models';
import {
  buildMaintenanceCompletion,
  buildSkipMaintenance,
  lifetimeMaintenanceCost,
  maintenanceDueStatus,
  maintenanceOccurrenceId,
  warrantyStatus,
} from '../logic';

const NOW = '2026-10-29T10:00:00.000Z';

function task(fields: Partial<MaintenanceTask> = {}): MaintenanceTask {
  return {
    id: 'task-1',
    householdId: 'h1',
    name: 'AC service',
    dueDate: '2026-10-29',
    priority: 'medium',
    status: 'scheduled',
    documentIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...fields,
  };
}

describe('warrantyStatus', () => {
  const today = '2026-10-29';
  it('reports none without an expiry date', () => {
    expect(warrantyStatus({}, today)).toBe('none');
  });
  it('distinguishes expired, expiring and active using the lead time', () => {
    expect(warrantyStatus({ warrantyExpiry: '2026-10-28' }, today)).toBe('expired');
    expect(warrantyStatus({ warrantyExpiry: '2026-10-29' }, today)).toBe('expiring');
    expect(warrantyStatus({ warrantyExpiry: '2026-11-28' }, today, 30)).toBe('expiring');
    expect(warrantyStatus({ warrantyExpiry: '2026-11-29' }, today, 30)).toBe('active');
    expect(warrantyStatus({ warrantyExpiry: '2026-11-10' }, today, 7)).toBe('active');
  });
});

describe('maintenanceDueStatus', () => {
  const today = '2026-10-29';
  it('derives overdue / due soon / scheduled from the due date', () => {
    expect(maintenanceDueStatus(task({ dueDate: '2026-10-28' }), today)).toBe('overdue');
    expect(maintenanceDueStatus(task({ dueDate: '2026-11-05' }), today, 7)).toBe('due-soon');
    expect(maintenanceDueStatus(task({ dueDate: '2026-11-06' }), today, 7)).toBe('scheduled');
  });
  it('keeps completed and cancelled regardless of date', () => {
    expect(maintenanceDueStatus(task({ dueDate: '2026-01-01', status: 'completed' }), today)).toBe('completed');
    expect(maintenanceDueStatus(task({ dueDate: '2026-01-01', status: 'cancelled' }), today)).toBe('cancelled');
  });
});

describe('lifetimeMaintenanceCost', () => {
  it('sums only recorded actual costs', () => {
    expect(lifetimeMaintenanceCost([{ actualCostMinor: 110000 }, { actualCostMinor: 240000 }, {}])).toEqual({
      totalMinor: 350000,
      costedCount: 2,
      uncostedCount: 1,
    });
  });
  it('is zero with no records', () => {
    expect(lifetimeMaintenanceCost([])).toEqual({ totalMinor: 0, costedCount: 0, uncostedCount: 0 });
  });
});

describe('buildMaintenanceCompletion', () => {
  const input = {
    completedDate: '2026-10-29',
    workPerformed: 'Filter wash',
    actualCostMinor: 120000,
    documentIds: [],
    recordExpense: true,
  };

  it('completes the task, records history and an expense linked to the record', () => {
    const result = buildMaintenanceCompletion({
      householdId: 'h1',
      userId: 'u1',
      now: NOW,
      input,
      task: task({ assetId: 'asset-1' }),
      assetName: 'Bedroom AC',
      existingTaskIds: new Set(['task-1']),
    });
    expect(result.record).toMatchObject({ assetId: 'asset-1', maintenanceTaskId: 'task-1', actualCostMinor: 120000, expenseId: result.expense?.id });
    expect(result.expense).toMatchObject({ amountMinor: 120000, source: 'maintenance', sourceId: result.record.id, category: 'Maintenance & repairs', payerId: 'u1' });
    expect(result.expense?.description).toBe('AC service — Bedroom AC');
    expect(result.changes.put?.maintenanceTasks?.[0]).toMatchObject({ id: 'task-1', status: 'completed', recordId: result.record.id });
    expect(result.next).toBeUndefined();
  });

  it('does not create an expense when the toggle is off or there is no cost', () => {
    const off = buildMaintenanceCompletion({ householdId: 'h1', userId: 'u1', now: NOW, input: { ...input, recordExpense: false }, task: task(), existingTaskIds: new Set() });
    expect(off.expense).toBeUndefined();
    expect(off.changes.put?.expenses).toBeUndefined();
    const free = buildMaintenanceCompletion({ householdId: 'h1', userId: 'u1', now: NOW, input: { ...input, actualCostMinor: undefined }, task: task(), existingTaskIds: new Set() });
    expect(free.expense).toBeUndefined();
  });

  it('schedules the next occurrence of a recurring task with a deterministic id', () => {
    const recurring = task({ recurrence: { frequency: 'monthly', interval: 6 }, seriesId: 'series-1', dueDate: '2026-11-04' });
    const result = buildMaintenanceCompletion({ householdId: 'h1', userId: 'u1', now: NOW, input, task: recurring, existingTaskIds: new Set(['task-1']) });
    expect(result.next).toMatchObject({ id: maintenanceOccurrenceId('series-1', '2027-05-04'), dueDate: '2027-05-04', status: 'scheduled', seriesId: 'series-1' });
    expect(result.changes.put?.maintenanceTasks).toHaveLength(2);
  });

  it('skips the next occurrence when it already exists', () => {
    const recurring = task({ recurrence: { frequency: 'quarterly', interval: 1 }, dueDate: '2026-10-26' });
    const existing = new Set(['task-1', maintenanceOccurrenceId('task-1', '2027-01-26')]);
    const result = buildMaintenanceCompletion({ householdId: 'h1', userId: 'u1', now: NOW, input, task: recurring, existingTaskIds: existing });
    expect(result.next).toBeUndefined();
  });

  it('logs past maintenance without a task', () => {
    const result = buildMaintenanceCompletion({ householdId: 'h1', userId: 'u1', now: NOW, input, assetId: 'asset-2', existingTaskIds: new Set() });
    expect(result.record).toMatchObject({ assetId: 'asset-2', maintenanceTaskId: undefined });
    expect(result.changes.put?.maintenanceTasks).toBeUndefined();
  });
});

describe('buildSkipMaintenance', () => {
  it('cancels the occurrence and schedules the next one for recurring tasks', () => {
    const changes = buildSkipMaintenance(task({ recurrence: { frequency: 'monthly', interval: 1 }, dueDate: '2026-10-15' }), new Set(['task-1']), NOW);
    expect(changes.put?.maintenanceTasks?.map((entry) => [entry.status, entry.dueDate])).toEqual([
      ['cancelled', '2026-10-15'],
      ['scheduled', '2026-11-15'],
    ]);
  });
  it('only cancels a one-off task', () => {
    expect(buildSkipMaintenance(task(), new Set(), NOW).put?.maintenanceTasks).toHaveLength(1);
  });
});
