import { describe, expect, it } from 'vitest';
import { commitChanges } from '@/data/actions';
import { loadHousehold } from '@/data/db';
import { setupHousehold } from '@/test/utils';
import { todayIn } from '@/lib/dates';
import { newId } from '@/lib/ids';
import type { Task } from '@/types/models';
import { buildCompletion, buildReopen } from '../logic';

function recurringTask(householdId: string, userId: string, dueDate: string): Task {
  const now = new Date().toISOString();
  const id = newId();
  return {
    id,
    householdId,
    title: 'Take out recycling',
    category: 'Cleaning',
    priority: 'low',
    status: 'not_started',
    dueDate,
    recurrence: { frequency: 'weekly', interval: 1 },
    seriesId: id,
    checklist: [],
    comments: [],
    boardOrder: 1,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
}

describe('completing recurring tasks through the data layer', () => {
  it('never duplicates the next occurrence when completed, reopened and completed again', async () => {
    const h = await setupHousehold();
    const today = todayIn('Asia/Kolkata');
    const original = recurringTask(h.householdId, h.userId, today);
    await h.seed({ put: { tasks: [original] } });

    const complete = async () => {
      const state = h.store.getState();
      const current = state.data.tasks[original.id]!;
      const { changes } = buildCompletion(current, state.data.tasks, { today, now: new Date().toISOString(), userId: h.userId });
      await h.store.dispatch(commitChanges(changes));
    };

    await complete();
    await h.store.dispatch(commitChanges({ put: { tasks: [buildReopen(h.store.getState().data.tasks[original.id]!, new Date().toISOString())] } }));
    await complete();

    const persisted = (await loadHousehold(h.householdId)).tasks;
    expect(persisted).toHaveLength(2);
    expect(persisted.filter((task) => task.id !== original.id)).toHaveLength(1);
    expect(persisted.find((task) => task.id === original.id)?.status).toBe('completed');
  });

  it('two completions computed from the same state (a double click) still produce one next occurrence', async () => {
    const h = await setupHousehold();
    const today = todayIn('Asia/Kolkata');
    const original = recurringTask(h.householdId, h.userId, today);
    await h.seed({ put: { tasks: [original] } });

    const state = h.store.getState();
    const context = { today, now: new Date().toISOString(), userId: h.userId };
    const first = buildCompletion(state.data.tasks[original.id]!, state.data.tasks, context);
    const second = buildCompletion(state.data.tasks[original.id]!, state.data.tasks, context);
    await Promise.all([h.store.dispatch(commitChanges(first.changes)), h.store.dispatch(commitChanges(second.changes))]);

    const persisted = (await loadHousehold(h.householdId)).tasks;
    expect(persisted).toHaveLength(2);
    expect(Object.keys(h.store.getState().data.tasks)).toHaveLength(2);
  });
});
