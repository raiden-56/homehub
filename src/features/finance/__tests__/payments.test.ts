import { describe, expect, it } from 'vitest';
import { commitChanges } from '@/data/actions';
import { loadHousehold } from '@/data/db';
import { DuplicateOperationError } from '@/data/errors';
import { setupHousehold } from '@/test/utils';
import type { Bill, BillOccurrence } from '@/types/models';
import { newId } from '@/lib/ids';
import { billPaymentKey, buildBillPayment, buildUndoPayment } from '../logic/payments';

async function setupBill() {
  const h = await setupHousehold();
  const now = new Date().toISOString();
  const bill: Bill = {
    id: newId(),
    householdId: h.householdId,
    name: 'Internet',
    category: 'Internet',
    amountMinor: 117900,
    startDate: '2026-10-12',
    recurrence: { frequency: 'monthly', interval: 1 },
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  const occurrence: BillOccurrence = {
    id: `${bill.id}_2026-10-12`,
    householdId: h.householdId,
    billId: bill.id,
    originalDate: '2026-10-12',
    dueDate: '2026-10-12',
    amountMinor: 117900,
    state: 'open',
    createdAt: now,
    updatedAt: now,
  };
  await h.seed({ put: { bills: [bill], billOccurrences: [occurrence] } });
  return { h, bill, occurrence };
}

const pay = (occurrence: BillOccurrence, bill: Bill, userId: string) =>
  buildBillPayment({
    occurrence,
    bill,
    paidAt: '2026-10-11',
    amountMinor: 117900,
    payerId: userId,
    recordExpense: true,
    expenseId: newId(),
    now: new Date().toISOString(),
  });

describe('bill payments', () => {
  it('records exactly one expense when the same payment is submitted twice', async () => {
    const { h, bill, occurrence } = await setupBill();
    const key = billPaymentKey(occurrence);
    await h.store.dispatch(commitChanges(pay(occurrence, bill, h.userId).changes, { idempotencyKey: key }));
    await expect(
      h.store.dispatch(commitChanges(pay(occurrence, bill, h.userId).changes, { idempotencyKey: key })),
    ).rejects.toBeInstanceOf(DuplicateOperationError);

    const snapshot = await loadHousehold(h.householdId);
    const fromBill = snapshot.expenses.filter((expense) => expense.sourceId === occurrence.id);
    expect(fromBill).toHaveLength(1);
    expect(fromBill[0]).toMatchObject({ source: 'bill', category: 'Internet & phone', amountMinor: 117900 });
    const stored = snapshot.billOccurrences.find((entry) => entry.id === occurrence.id)!;
    expect(stored).toMatchObject({ state: 'paid', paidAt: '2026-10-11', expenseId: fromBill[0]!.id });
  });

  it('can be paid again after the payment is undone', async () => {
    const { h, bill, occurrence } = await setupBill();
    await h.store.dispatch(commitChanges(pay(occurrence, bill, h.userId).changes, { idempotencyKey: billPaymentKey(occurrence) }));
    const paid = h.store.getState().data.billOccurrences[occurrence.id]!;
    await h.store.dispatch(commitChanges(buildUndoPayment(paid, true, new Date(Date.now() + 1000).toISOString())));
    let state = h.store.getState().data;
    expect(state.billOccurrences[occurrence.id]?.state).toBe('open');
    expect(Object.values(state.expenses)).toHaveLength(0);

    const reopened = state.billOccurrences[occurrence.id]!;
    await h.store.dispatch(commitChanges(pay(reopened, bill, h.userId).changes, { idempotencyKey: billPaymentKey(reopened) }));
    state = h.store.getState().data;
    expect(state.billOccurrences[occurrence.id]?.state).toBe('paid');
    expect(Object.values(state.expenses)).toHaveLength(1);
  });

  it('can mark paid without recording an expense', async () => {
    const { h, bill, occurrence } = await setupBill();
    const { changes, expense } = buildBillPayment({
      occurrence,
      bill,
      paidAt: '2026-10-11',
      amountMinor: 100000,
      payerId: h.userId,
      recordExpense: false,
      expenseId: newId(),
      now: new Date().toISOString(),
    });
    expect(expense).toBeUndefined();
    await h.store.dispatch(commitChanges(changes));
    expect(h.store.getState().data.billOccurrences[occurrence.id]).toMatchObject({ state: 'paid', paidAmountMinor: 100000, expenseId: undefined });
  });
});
