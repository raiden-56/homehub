import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, setupHousehold } from '@/test/utils';
import { todayIn } from '@/lib/dates';
import { newId } from '@/lib/ids';
import type { Bill, BillOccurrence } from '@/types/models';
import { MarkBillPaidDialog } from '../components/MarkBillPaidDialog';
import { ExpenseDialog } from '../components/ExpenseDialog';

describe('MarkBillPaidDialog', () => {
  it('marks the bill paid and records a matching expense', async () => {
    const h = await setupHousehold();
    const now = new Date().toISOString();
    const due = todayIn('Asia/Kolkata');
    const bill: Bill = {
      id: newId(),
      householdId: h.householdId,
      name: 'Electricity',
      category: 'Electricity',
      amountMinor: 234000,
      startDate: due,
      active: true,
      payerId: h.userId,
      createdAt: now,
      updatedAt: now,
    };
    const occurrence: BillOccurrence = {
      id: `${bill.id}_${due}`,
      householdId: h.householdId,
      billId: bill.id,
      originalDate: due,
      dueDate: due,
      amountMinor: 234000,
      state: 'open',
      createdAt: now,
      updatedAt: now,
    };
    await h.seed({ put: { bills: [bill], billOccurrences: [occurrence] } });
    const onClose = vi.fn();
    renderWithProviders(<MarkBillPaidDialog open occurrence={occurrence} onClose={onClose} />, { store: h.store });

    expect(screen.getByLabelText(/amount paid/i)).toHaveValue('2340.00');
    await userEvent.click(screen.getByRole('button', { name: 'Mark as paid' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const data = h.store.getState().data;
    expect(data.billOccurrences[occurrence.id]).toMatchObject({ state: 'paid', paidAmountMinor: 234000, paidBy: h.userId });
    const expenses = Object.values(data.expenses);
    expect(expenses).toHaveLength(1);
    expect(expenses[0]).toMatchObject({ source: 'bill', sourceId: occurrence.id, category: 'Utilities', amountMinor: 234000 });
  });
});

describe('ExpenseDialog', () => {
  it('records a manual expense', async () => {
    const h = await setupHousehold();
    const onClose = vi.fn();
    renderWithProviders(<ExpenseDialog open onClose={onClose} />, { store: h.store });
    await userEvent.type(screen.getByLabelText(/description/i), 'Vegetables');
    await userEvent.type(screen.getByLabelText(/^amount/i), '450.50');
    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const expenses = Object.values(h.store.getState().data.expenses);
    expect(expenses).toEqual([expect.objectContaining({ description: 'Vegetables', amountMinor: 45050, source: 'manual', payerId: h.userId })]);
  });

  it('blocks saving when custom split amounts do not add up', async () => {
    const h = await setupHousehold();
    const other = await h.addMember('Riya', 'member');
    const onClose = vi.fn();
    renderWithProviders(<ExpenseDialog open onClose={onClose} />, { store: h.store });
    await userEvent.type(screen.getByLabelText(/description/i), 'Dinner');
    await userEvent.type(screen.getByLabelText(/^amount/i), '100');
    await userEvent.click(screen.getByLabelText('Split this expense'));
    await userEvent.click(screen.getByRole('button', { name: 'Custom amounts' }));
    await userEvent.type(screen.getByLabelText('Test Owner amount'), '60');
    await userEvent.type(screen.getByLabelText('Riya amount'), '30');

    expect(screen.getAllByText(/don’t add up/i).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(Object.values(h.store.getState().data.expenses)).toHaveLength(0);

    await userEvent.clear(screen.getByLabelText('Riya amount'));
    await userEvent.type(screen.getByLabelText('Riya amount'), '40');
    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [saved] = Object.values(h.store.getState().data.expenses);
    expect(saved?.split?.shares).toEqual([
      { userId: h.userId, shareMinor: 6000 },
      { userId: other, shareMinor: 4000 },
    ]);
  });
});
