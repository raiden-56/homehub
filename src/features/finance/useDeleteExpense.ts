import { useCallback } from 'react';
import { useAppSelector, useCommit } from '@/app/hooks';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import type { ChangeSet } from '@/data/collections';
import { nowIso } from '@/lib/ids';
import type { Expense } from '@/types/models';

const SOURCE_WARNINGS: Partial<Record<Expense['source'], string>> = {
  bill: ' The bill stays marked as paid.',
  shopping: ' The shopping purchase and any inventory update stay recorded.',
  maintenance: ' The maintenance record stays in the asset history.',
};

/**
 * Deletes an expense after confirmation and clears the back-reference held by the bill payment,
 * shopping item or maintenance record that created it, so nothing points at a missing expense.
 */
export function useDeleteExpense() {
  const commit = useCommit();
  const confirm = useConfirm();
  const data = useAppSelector((state) => state.data);

  return useCallback(
    async (expense: Expense) => {
      const accepted = await confirm({
        title: `Delete “${expense.description}”?`,
        description: `This removes the expense from budgets, balances and reports.${SOURCE_WARNINGS[expense.source] ?? ''}`,
        confirmLabel: 'Delete expense',
        destructive: true,
      });
      if (!accepted) return false;
      const now = nowIso();
      const put: ChangeSet['put'] = {};
      if (expense.source === 'bill' && expense.sourceId) {
        const occurrence = data.billOccurrences[expense.sourceId];
        if (occurrence?.expenseId === expense.id) put.billOccurrences = [{ ...occurrence, expenseId: undefined, updatedAt: now }];
      }
      if (expense.source === 'shopping' && expense.sourceId) {
        const item = data.shoppingItems[expense.sourceId];
        if (item?.expenseId === expense.id) put.shoppingItems = [{ ...item, expenseId: undefined, updatedAt: now }];
      }
      if (expense.source === 'maintenance' && expense.sourceId) {
        const record = data.maintenanceRecords[expense.sourceId];
        if (record?.expenseId === expense.id) put.maintenanceRecords = [{ ...record, expenseId: undefined, updatedAt: now }];
      }
      return commit(
        { put, remove: { expenses: [expense.id] } },
        { activity: { entity: 'expense', entityId: expense.id, message: `Deleted the expense “${expense.description}”` }, success: 'Expense deleted' },
      );
    },
    [commit, confirm, data],
  );
}
