import { useCallback } from 'react';
import { useAppSelector, useCollection, useCommit, useToday } from '@/app/hooks';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { nowIso } from '@/lib/ids';
import type { Bill, BillOccurrence } from '@/types/models';
import { futureOpenOccurrences } from './logic/bills';
import { buildUndoPayment } from './logic/payments';

/** Bill operations shared by the bills list and the bill detail drawer. */
export function useBillActions() {
  const commit = useCommit();
  const confirm = useConfirm();
  const today = useToday();
  const occurrences = useCollection('billOccurrences');
  const expenses = useAppSelector((state) => state.data.expenses);

  const undoPayment = useCallback(
    async (occurrence: BillOccurrence, bill: Bill) => {
      const expense = occurrence.expenseId ? expenses[occurrence.expenseId] : undefined;
      const accepted = await confirm({
        title: 'Undo this payment?',
        description: expense
          ? `“${bill.name}” will be marked unpaid and the expense recorded for it will be deleted.`
          : `“${bill.name}” will be marked unpaid.`,
        confirmLabel: 'Undo payment',
        destructive: true,
      });
      if (!accepted) return false;
      return commit(buildUndoPayment(occurrence, !!expense, nowIso()), {
        activity: { entity: 'bill', entityId: occurrence.id, message: `Marked “${bill.name}” as unpaid` },
        success: 'Payment undone',
      });
    },
    [commit, confirm, expenses],
  );

  const setOccurrenceState = useCallback(
    (occurrence: BillOccurrence, bill: Bill, state: 'cancelled' | 'open') =>
      commit(
        { put: { billOccurrences: [{ ...occurrence, state, updatedAt: nowIso() }] } },
        {
          activity: {
            entity: 'bill',
            entityId: occurrence.id,
            message: state === 'cancelled' ? `Cancelled one occurrence of “${bill.name}”` : `Restored one occurrence of “${bill.name}”`,
          },
          success: state === 'cancelled' ? 'Bill cancelled' : 'Bill restored',
          undo: { put: { billOccurrences: [occurrence] } },
        },
      ),
    [commit],
  );

  const setSeriesActive = useCallback(
    async (bill: Bill, active: boolean) => {
      if (!active) {
        const accepted = await confirm({
          title: `Stop “${bill.name}”?`,
          description: 'No new bills will be created and unpaid upcoming ones will be removed. Paid and overdue bills stay in your history.',
          confirmLabel: 'Stop series',
          destructive: true,
        });
        if (!accepted) return false;
      }
      const remove = active ? [] : futureOpenOccurrences(bill.id, occurrences, today).map((occurrence) => occurrence.id);
      return commit(
        {
          put: { bills: [{ ...bill, active, updatedAt: nowIso() }] },
          ...(remove.length ? { remove: { billOccurrences: remove } } : {}),
        },
        {
          activity: { entity: 'bill', entityId: bill.id, message: active ? `Resumed the bill “${bill.name}”` : `Stopped the bill “${bill.name}”` },
          success: active ? 'Bill series resumed' : 'Bill series stopped',
        },
      );
    },
    [commit, confirm, occurrences, today],
  );

  const deleteBill = useCallback(
    async (bill: Bill) => {
      const own = occurrences.filter((occurrence) => occurrence.billId === bill.id);
      const paid = own.filter((occurrence) => occurrence.expenseId && expenses[occurrence.expenseId]).length;
      const accepted = await confirm({
        title: `Delete “${bill.name}”?`,
        description: `This removes the bill and its ${own.length} scheduled or past occurrence${own.length === 1 ? '' : 's'}.${
          paid ? ` The ${paid} expense${paid === 1 ? '' : 's'} already recorded from payments will be kept.` : ''
        } This can’t be undone.`,
        confirmLabel: 'Delete bill',
        destructive: true,
      });
      if (!accepted) return false;
      return commit(
        { remove: { bills: [bill.id], billOccurrences: own.map((occurrence) => occurrence.id) } },
        { activity: { entity: 'bill', entityId: bill.id, message: `Deleted the bill “${bill.name}”` }, success: 'Bill deleted' },
      );
    },
    [commit, confirm, occurrences, expenses],
  );

  return { undoPayment, setOccurrenceState, setSeriesActive, deleteBill };
}
