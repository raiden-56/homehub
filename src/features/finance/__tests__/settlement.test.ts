import { describe, expect, it } from 'vitest';
import type { Expense, Settlement } from '@/types/models';
import { computeBalances, minimizeTransfers, type Balances } from '../logic/settlement';
import { equalSplit } from '../logic/splits';

const NOW = '2026-10-29T08:00:00.000Z';

function expense(id: string, payerId: string, amountMinor: number, userIds?: string[]): Expense {
  return {
    id,
    householdId: 'h1',
    description: id,
    amountMinor,
    date: '2026-10-01',
    category: 'Groceries',
    payerId,
    source: 'manual',
    split: userIds ? { method: 'equal', shares: equalSplit(amountMinor, userIds) } : undefined,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const sum = (balances: Balances) => Object.values(balances).reduce((total, value) => total + value, 0);

describe('computeBalances', () => {
  it('credits the payer and debits each participant', () => {
    const balances = computeBalances([expense('e1', 'a', 900, ['a', 'b', 'c'])], [], ['a', 'b', 'c']);
    expect(balances).toEqual({ a: 600, b: -300, c: -300 });
    expect(sum(balances)).toBe(0);
  });

  it('ignores unsplit (personal) expenses but lists every member', () => {
    expect(computeBalances([expense('e1', 'a', 900)], [], ['a', 'b'])).toEqual({ a: 0, b: 0 });
  });

  it('applies settlements', () => {
    const settlement: Settlement = {
      id: 's1',
      householdId: 'h1',
      fromUserId: 'b',
      toUserId: 'a',
      amountMinor: 300,
      date: '2026-10-02',
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(computeBalances([expense('e1', 'a', 900, ['a', 'b', 'c'])], [settlement], ['a', 'b', 'c'])).toEqual({ a: 300, b: 0, c: -300 });
  });
});

describe('minimizeTransfers', () => {
  it('returns no transfers when everyone is settled', () => {
    expect(minimizeTransfers({ a: 0, b: 0 })).toEqual([]);
  });

  it('settles every balance with at most n − 1 transfers and conserves totals', () => {
    const balances: Balances = { a: 700, b: -200, c: -450, d: 150, e: -200 };
    const transfers = minimizeTransfers(balances);
    expect(transfers.length).toBeLessThanOrEqual(Object.keys(balances).length - 1);
    const after: Balances = { ...balances };
    for (const transfer of transfers) {
      expect(transfer.amountMinor).toBeGreaterThan(0);
      after[transfer.fromUserId] = (after[transfer.fromUserId] ?? 0) + transfer.amountMinor;
      after[transfer.toUserId] = (after[transfer.toUserId] ?? 0) - transfer.amountMinor;
    }
    expect(Object.values(after).every((value) => value === 0)).toBe(true);
  });

  it('uses a single transfer for one debtor and one creditor', () => {
    expect(minimizeTransfers({ a: 500, b: -500 })).toEqual([{ fromUserId: 'b', toUserId: 'a', amountMinor: 500 }]);
  });
});
