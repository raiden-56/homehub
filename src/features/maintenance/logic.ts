import type { ChangeSet } from '@/data/collections';
import type { Asset, Expense, ISODate, MaintenanceRecord, MaintenanceTask } from '@/types/models';
import { daysBetween } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { nextOccurrence } from '@/lib/recurrence';

export type WarrantyStatus = 'active' | 'expiring' | 'expired' | 'none';
export type MaintenanceDueStatus = 'overdue' | 'due-soon' | 'scheduled' | 'completed' | 'cancelled';

export const WARRANTY_LABELS: Record<WarrantyStatus, string> = {
  active: 'Under warranty',
  expiring: 'Warranty expiring',
  expired: 'Warranty expired',
  none: 'No warranty info',
};

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceDueStatus, string> = {
  overdue: 'Overdue',
  'due-soon': 'Due soon',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const DEFAULT_WARRANTY_LEAD_DAYS = 30;
export const DEFAULT_MAINTENANCE_LEAD_DAYS = 7;

export function warrantyStatus(
  asset: Pick<Asset, 'warrantyExpiry'>,
  today: ISODate,
  leadDays = DEFAULT_WARRANTY_LEAD_DAYS,
): WarrantyStatus {
  if (!asset.warrantyExpiry) return 'none';
  const days = daysBetween(today, asset.warrantyExpiry);
  if (days < 0) return 'expired';
  if (days <= leadDays) return 'expiring';
  return 'active';
}

export function maintenanceDueStatus(
  task: Pick<MaintenanceTask, 'status' | 'dueDate'>,
  today: ISODate,
  leadDays = DEFAULT_MAINTENANCE_LEAD_DAYS,
): MaintenanceDueStatus {
  if (task.status === 'completed') return 'completed';
  if (task.status === 'cancelled') return 'cancelled';
  const days = daysBetween(today, task.dueDate);
  if (days < 0) return 'overdue';
  if (days <= leadDays) return 'due-soon';
  return 'scheduled';
}

/* ------------------------------------------------------------------ */
/* Costs                                                               */
/* ------------------------------------------------------------------ */

/** Sum of recorded (actual) costs; records without a cost are counted separately, never estimated. */
export function lifetimeMaintenanceCost(records: Pick<MaintenanceRecord, 'actualCostMinor'>[]): {
  totalMinor: number;
  costedCount: number;
  uncostedCount: number;
} {
  let totalMinor = 0;
  let costedCount = 0;
  for (const record of records) {
    if (record.actualCostMinor === undefined) continue;
    totalMinor += record.actualCostMinor;
    costedCount += 1;
  }
  return { totalMinor, costedCount, uncostedCount: records.length - costedCount };
}

/* ------------------------------------------------------------------ */
/* Completion & recurrence                                             */
/* ------------------------------------------------------------------ */

export const MAINTENANCE_EXPENSE_CATEGORY = 'Maintenance & repairs';

export function maintenanceSeriesId(task: Pick<MaintenanceTask, 'id' | 'seriesId'>): string {
  return task.seriesId ?? task.id;
}

/** Deterministic id for a series occurrence, so regenerating it can never create a duplicate. */
export function maintenanceOccurrenceId(seriesId: string, date: ISODate): string {
  return `${seriesId}@${date}`;
}

/** The next scheduled occurrence of a recurring task, or `null` if it doesn't repeat / has ended / exists. */
export function nextMaintenanceTask(
  task: MaintenanceTask,
  existingIds: ReadonlySet<string>,
  now: string,
): MaintenanceTask | null {
  if (!task.recurrence) return null;
  const nextDate = nextOccurrence(task.recurrence, task.dueDate, task.dueDate);
  if (!nextDate) return null;
  const seriesId = maintenanceSeriesId(task);
  const id = maintenanceOccurrenceId(seriesId, nextDate);
  if (existingIds.has(id)) return null;
  return {
    id,
    householdId: task.householdId,
    name: task.name,
    assetId: task.assetId,
    description: task.description,
    dueDate: nextDate,
    recurrence: task.recurrence,
    seriesId,
    priority: task.priority,
    assigneeId: task.assigneeId,
    provider: task.provider,
    estimatedCostMinor: task.estimatedCostMinor,
    status: 'scheduled',
    notes: task.notes,
    documentIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export interface CompletionInput {
  completedDate: ISODate;
  workPerformed: string;
  provider?: string;
  actualCostMinor?: number;
  notes?: string;
  documentIds: string[];
  recordExpense: boolean;
}

export interface CompletionResult {
  changes: ChangeSet;
  record: MaintenanceRecord;
  expense?: Expense;
  next?: MaintenanceTask;
}

/**
 * Builds the single atomic change for completing maintenance: the history record, the completed
 * task (when there is one), an optional expense for the actual cost, and the next occurrence of a
 * recurring task. Without a task this logs past maintenance for `assetId`.
 */
export function buildMaintenanceCompletion(options: {
  householdId: string;
  userId: string;
  now: string;
  input: CompletionInput;
  task?: MaintenanceTask;
  assetId?: string;
  assetName?: string;
  existingTaskIds: ReadonlySet<string>;
}): CompletionResult {
  const { householdId, userId, now, input, task, existingTaskIds } = options;
  const assetId = task?.assetId ?? options.assetId;
  const recordId = newId();
  const wantsExpense = input.recordExpense && input.actualCostMinor !== undefined && input.actualCostMinor > 0;
  const expenseId = wantsExpense ? newId() : undefined;
  const record: MaintenanceRecord = {
    id: recordId,
    householdId,
    assetId,
    maintenanceTaskId: task?.id,
    completedDate: input.completedDate,
    workPerformed: input.workPerformed.trim(),
    provider: input.provider?.trim() || undefined,
    actualCostMinor: input.actualCostMinor,
    notes: input.notes?.trim() || undefined,
    documentIds: input.documentIds,
    expenseId,
    recordedBy: userId,
    createdAt: now,
    updatedAt: now,
  };
  const expense: Expense | undefined = wantsExpense
    ? {
        id: expenseId!,
        householdId,
        description: [task?.name ?? record.workPerformed, options.assetName].filter(Boolean).join(' — '),
        amountMinor: input.actualCostMinor!,
        date: input.completedDate,
        category: MAINTENANCE_EXPENSE_CATEGORY,
        payerId: userId,
        source: 'maintenance',
        sourceId: recordId,
        createdAt: now,
        updatedAt: now,
      }
    : undefined;
  const tasks: MaintenanceTask[] = [];
  let next: MaintenanceTask | undefined;
  if (task) {
    tasks.push({
      ...task,
      status: 'completed',
      recordId,
      documentIds: [...new Set([...task.documentIds, ...input.documentIds])],
      updatedAt: now,
    });
    next = nextMaintenanceTask(task, existingTaskIds, now) ?? undefined;
    if (next) tasks.push(next);
  }
  return {
    record,
    expense,
    next,
    changes: {
      put: {
        maintenanceRecords: [record],
        ...(tasks.length ? { maintenanceTasks: tasks } : {}),
        ...(expense ? { expenses: [expense] } : {}),
      },
    },
  };
}

/** Skips (cancels) one occurrence; a recurring task still gets its next occurrence scheduled. */
export function buildSkipMaintenance(task: MaintenanceTask, existingTaskIds: ReadonlySet<string>, now: string): ChangeSet {
  const next = nextMaintenanceTask(task, existingTaskIds, now);
  return {
    put: { maintenanceTasks: [{ ...task, status: 'cancelled', updatedAt: now }, ...(next ? [next] : [])] },
  };
}

/* ------------------------------------------------------------------ */
/* Grouping                                                            */
/* ------------------------------------------------------------------ */

export type ScheduleGroup = 'overdue' | 'due-soon' | 'scheduled' | 'done';

export const SCHEDULE_GROUP_LABELS: Record<ScheduleGroup, string> = {
  overdue: 'Overdue',
  'due-soon': 'Due soon',
  scheduled: 'Scheduled',
  done: 'Completed & skipped',
};

export function scheduleGroup(status: MaintenanceDueStatus): ScheduleGroup {
  return status === 'completed' || status === 'cancelled' ? 'done' : status;
}
