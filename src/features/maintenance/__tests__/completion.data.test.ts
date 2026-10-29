import { describe, expect, it } from 'vitest';
import { commitChanges } from '@/data/actions';
import { DuplicateOperationError } from '@/data/errors';
import { loadHousehold } from '@/data/db';
import { setupHousehold } from '@/test/utils';
import type { MaintenanceTask } from '@/types/models';
import { buildMaintenanceCompletion } from '../logic';

describe('completing a recurring maintenance task through the data layer', () => {
  it('records exactly one completion, expense and next occurrence even if submitted twice', async () => {
    const h = await setupHousehold();
    const now = new Date().toISOString();
    const task: MaintenanceTask = {
      id: 'ac-service',
      householdId: h.householdId,
      name: 'AC service',
      dueDate: '2026-10-29',
      recurrence: { frequency: 'monthly', interval: 6 },
      seriesId: 'ac-series',
      priority: 'medium',
      status: 'scheduled',
      documentIds: [],
      createdAt: now,
      updatedAt: now,
    };
    await h.seed({ put: { maintenanceTasks: [task] } });

    const complete = () => {
      const tasks = Object.values(h.store.getState().data.maintenanceTasks);
      // Both attempts start from the same (pre-completion) task, as a double click would.
      const result = buildMaintenanceCompletion({
        householdId: h.householdId,
        userId: h.userId,
        now,
        task,
        existingTaskIds: new Set(tasks.map((entry) => entry.id)),
        input: { completedDate: '2026-10-29', workPerformed: 'Wet service', actualCostMinor: 110000, documentIds: [], recordExpense: true },
      });
      return h.store.dispatch(commitChanges(result.changes, { idempotencyKey: `maintenance-complete:${task.id}` }));
    };

    await complete();
    await expect(complete()).rejects.toBeInstanceOf(DuplicateOperationError);

    const snapshot = await loadHousehold(h.householdId);
    expect(snapshot.maintenanceRecords).toHaveLength(1);
    expect(snapshot.expenses).toHaveLength(1);
    expect(snapshot.expenses[0]).toMatchObject({ amountMinor: 110000, source: 'maintenance', sourceId: snapshot.maintenanceRecords[0]!.id });
    const tasks = snapshot.maintenanceTasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    expect(tasks.map((entry) => [entry.id, entry.status])).toEqual([
      ['ac-service', 'completed'],
      ['ac-series@2027-04-29', 'scheduled'],
    ]);
  });
});
