import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Priority } from '@/types/models';
import type { TaskDueFilter, TaskFilters, TaskSort, TaskStatusFilter } from './logic';

export type TaskView = 'list' | 'board' | 'calendar' | 'workload';

const VIEWS: TaskView[] = ['list', 'board', 'calendar', 'workload'];
const STATUSES: TaskStatusFilter[] = ['open', 'overdue', 'completed', 'all'];
const SORTS: TaskSort[] = ['due', 'priority', 'created', 'title'];

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Task filters, sort and view, kept in the URL so links (e.g. from the dashboard) open filtered. */
export function useTaskFilters() {
  const [params, setParams] = useSearchParams();

  const filters: TaskFilters = useMemo(
    () => ({
      status: pick(params.get('status'), STATUSES, 'open'),
      due: pick<TaskDueFilter>(params.get('due'), ['today', 'week', ''], ''),
      assignee: params.get('assignee') ?? '',
      priority: pick<Priority | ''>(params.get('priority'), ['low', 'medium', 'high', ''], ''),
      category: params.get('category') ?? '',
      q: params.get('q') ?? '',
    }),
    [params],
  );
  const explicitView = params.get('view');
  const view = explicitView ? pick(explicitView, VIEWS, 'list') : null;
  const sort = pick(params.get('sort'), SORTS, 'due');

  const update = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === undefined || value === '') next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const activeFilterCount = [
    filters.status !== 'open',
    filters.due,
    filters.assignee,
    filters.priority,
    filters.category,
  ].filter(Boolean).length;

  const clear = useCallback(
    () => update({ status: null, due: null, assignee: null, priority: null, category: null, q: null }),
    [update],
  );

  return { filters, view, sort, update, clear, activeFilterCount };
}
