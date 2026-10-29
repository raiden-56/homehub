import { useCallback, useRef } from 'react';
import { useStore } from 'react-redux';
import type { RootState } from '@/app/store';
import { useCommit, useCurrentUser, useToday } from '@/app/hooks';
import type { ChangeSet } from '@/data/collections';
import { nowIso } from '@/lib/ids';
import { relativeDay } from '@/lib/dates';
import type { Task, TaskStatus } from '@/types/models';
import { buildCompletion, buildNextOccurrence, buildReopen, nextDueDate, seriesAnchor, seriesIdOf } from './logic';

/**
 * Completes a task. Recurring tasks get their next occurrence in the same commit; occurrence ids
 * are deterministic, so a double click or re-completion never creates duplicates.
 */
export function useCompleteTask(): (task: Task) => Promise<boolean> {
  const commit = useCommit();
  const store = useStore<RootState>();
  const user = useCurrentUser();
  const today = useToday();
  const inFlight = useRef(new Set<string>());

  return useCallback(
    async (task: Task) => {
      if (!user || inFlight.current.has(task.id)) return false;
      const current = store.getState().data.tasks[task.id] ?? task;
      if (current.status === 'completed') return true;
      inFlight.current.add(task.id);
      try {
        const { changes, next } = buildCompletion(current, store.getState().data.tasks, {
          today,
          now: nowIso(),
          userId: user.id,
        });
        const undo: ChangeSet = { put: { tasks: [current] }, ...(next ? { remove: { tasks: [next.id] } } : {}) };
        return await commit(changes, {
          activity: { entity: 'task', entityId: task.id, message: `Completed “${task.title}”` },
          success: next ? `Done! Next “${task.title}” is due ${relativeDay(next.dueDate!, today).toLowerCase()}` : `Completed “${task.title}”`,
          undo,
        });
      } finally {
        inFlight.current.delete(task.id);
      }
    },
    [commit, store, user, today],
  );
}

/** Reopens a completed task. Any next occurrence that was already generated is kept. */
export function useReopenTask(): (task: Task, status?: Exclude<TaskStatus, 'completed'>) => Promise<boolean> {
  const commit = useCommit();
  return useCallback(
    (task: Task, status: Exclude<TaskStatus, 'completed'> = 'not_started') =>
      commit(
        { put: { tasks: [buildReopen(task, nowIso(), status)] } },
        {
          activity: { entity: 'task', entityId: task.id, message: `Reopened “${task.title}”` },
          success: `Reopened “${task.title}”`,
          undo: { put: { tasks: [task] } },
        },
      ),
    [commit],
  );
}

/** Moves a task between statuses, routing completion/reopening through the proper logic. */
export function useSetTaskStatus() {
  const commit = useCommit();
  const complete = useCompleteTask();
  const reopen = useReopenTask();
  return useCallback(
    async (task: Task, status: TaskStatus, extra: Partial<Task> = {}) => {
      if (status === 'completed') {
        if (Object.keys(extra).length > 0) task = { ...task, ...extra };
        return complete(task);
      }
      if (task.status === 'completed') return reopen({ ...task, ...extra }, status);
      return commit(
        { put: { tasks: [{ ...task, ...extra, status, updatedAt: nowIso() }] } },
        {
          activity: { entity: 'task', entityId: task.id, message: `Moved “${task.title}” to ${status === 'in_progress' ? 'in progress' : 'not started'}` },
        },
      );
    },
    [commit, complete, reopen],
  );
}

export type DeleteMode = 'single' | 'skip' | 'series';

/**
 * Deletes a task.
 * - `single`: one-off task.
 * - `skip`: removes this occurrence of a recurring task and schedules the next one.
 * - `series`: removes this and any other open occurrences; completed history is kept.
 */
export function useDeleteTask() {
  const commit = useCommit();
  const store = useStore<RootState>();
  const today = useToday();
  return useCallback(
    async (task: Task, mode: DeleteMode) => {
      const tasks = store.getState().data.tasks;
      const now = nowIso();
      if (mode === 'series') {
        const seriesId = seriesIdOf(task);
        const open = Object.values(tasks).filter((other) => seriesIdOf(other) === seriesId && other.status !== 'completed');
        const removeIds = [...new Set([task.id, ...open.map((other) => other.id)])];
        return commit(
          { remove: { tasks: removeIds } },
          {
            activity: { entity: 'task', entityId: task.id, message: `Deleted “${task.title}” and stopped it repeating` },
            success: `Deleted “${task.title}” and stopped repeating`,
            undo: { put: { tasks: removeIds.map((id) => tasks[id]!).filter(Boolean) } },
          },
        );
      }
      const put: Task[] = [];
      if (mode === 'skip' && task.recurrence) {
        const due = nextDueDate(task, seriesAnchor(task, Object.values(tasks)), today);
        if (due) {
          const next = buildNextOccurrence(task, due, now);
          if (!tasks[next.id] && next.id !== task.id) put.push(next);
        }
      }
      return commit(
        { remove: { tasks: [task.id] }, ...(put.length ? { put: { tasks: put } } : {}) },
        {
          activity: { entity: 'task', entityId: task.id, message: mode === 'skip' ? `Skipped “${task.title}”` : `Deleted “${task.title}”` },
          success: mode === 'skip' ? `Removed this occurrence of “${task.title}”` : `Deleted “${task.title}”`,
          undo: { put: { tasks: [task] }, ...(put.length ? { remove: { tasks: put.map((next) => next.id) } } : {}) },
        },
      );
    },
    [commit, store, today],
  );
}
