import { describe, expect, it } from 'vitest';
import type { Bill, BillOccurrence } from '@/types/models';
import {
  billOccurrenceId,
  billStatus,
  futureOpenOccurrences,
  missingBillOccurrences,
  monthlyEquivalentMinor,
} from '../logic/bills';
import { buildSeriesUpdate } from '../logic/payments';

const NOW = '2026-10-29T08:00:00.000Z';

function bill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: 'bill-1',
    householdId: 'h1',
    name: 'Electricity',
    category: 'Electricity',
    amountMinor: 234000,
    startDate: '2026-06-18',
    recurrence: { frequency: 'monthly', interval: 1 },
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function occurrence(overrides: Partial<BillOccurrence> = {}): BillOccurrence {
  return {
    id: 'bill-1_2026-11-18',
    householdId: 'h1',
    billId: 'bill-1',
    originalDate: '2026-11-18',
    dueDate: '2026-11-18',
    amountMinor: 234000,
    state: 'open',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('billStatus', () => {
  const today = '2026-10-29';
  it('derives overdue, due soon and upcoming from the due date', () => {
    expect(billStatus(occurrence({ dueDate: '2026-10-28' }), today)).toBe('overdue');
    expect(billStatus(occurrence({ dueDate: '2026-10-29' }), today)).toBe('due-soon');
    expect(billStatus(occurrence({ dueDate: '2026-11-05' }), today)).toBe('due-soon');
    expect(billStatus(occurrence({ dueDate: '2026-11-06' }), today)).toBe('upcoming');
  });
  it('respects a custom due-soon window', () => {
    expect(billStatus(occurrence({ dueDate: '2026-11-03' }), today, 3)).toBe('upcoming');
    expect(billStatus(occurrence({ dueDate: '2026-11-01' }), today, 3)).toBe('due-soon');
  });
  it('paid and cancelled override dates', () => {
    expect(billStatus(occurrence({ dueDate: '2026-01-01', state: 'paid' }), today)).toBe('paid');
    expect(billStatus(occurrence({ dueDate: '2026-01-01', state: 'cancelled' }), today)).toBe('cancelled');
  });
});

describe('missingBillOccurrences', () => {
  const today = '2026-10-29';
  it('generates monthly occurrences from a month back up to the horizon with deterministic ids', () => {
    const result = missingBillOccurrences(bill(), new Set(), today, NOW, 60);
    expect(result.map((entry) => entry.dueDate)).toEqual(['2026-10-18', '2026-11-18', '2026-12-18']);
    expect(result[0]!.id).toBe(billOccurrenceId('bill-1', '2026-10-18'));
    expect(result.every((entry) => entry.state === 'open' && entry.amountMinor === 234000)).toBe(true);
  });

  it('never duplicates when re-run with the existing ids', () => {
    const first = missingBillOccurrences(bill(), new Set(), today, NOW, 60);
    const second = missingBillOccurrences(bill(), new Set(first.map((entry) => entry.id)), today, NOW, 60);
    expect(second).toEqual([]);
  });

  it('generates nothing for an inactive series', () => {
    expect(missingBillOccurrences(bill({ active: false }), new Set(), today, NOW)).toEqual([]);
  });

  it('creates a single occurrence for a one-off bill, even if it is in the past', () => {
    const oneOff = bill({ recurrence: undefined, startDate: '2026-05-02' });
    const result = missingBillOccurrences(oneOff, new Set(), today, NOW);
    expect(result.map((entry) => entry.dueDate)).toEqual(['2026-05-02']);
    expect(missingBillOccurrences(oneOff, new Set([result[0]!.id]), today, NOW)).toEqual([]);
  });

  it('spaces quarterly bills three months apart', () => {
    const water = bill({ id: 'water', startDate: '2026-01-25', recurrence: { frequency: 'quarterly', interval: 1 } });
    const result = missingBillOccurrences(water, new Set(), today, NOW, 120);
    expect(result.map((entry) => entry.dueDate)).toEqual(['2026-10-25', '2027-01-25']);
  });
});

describe('monthlyEquivalentMinor', () => {
  it('normalises schedules to a monthly cost', () => {
    expect(monthlyEquivalentMinor(bill({ amountMinor: 120000, recurrence: { frequency: 'yearly', interval: 1 } }))).toBe(10000);
    expect(monthlyEquivalentMinor(bill({ amountMinor: 30000, recurrence: { frequency: 'quarterly', interval: 1 } }))).toBe(10000);
    expect(monthlyEquivalentMinor(bill({ amountMinor: 10000, recurrence: { frequency: 'monthly', interval: 2 } }))).toBe(5000);
    expect(monthlyEquivalentMinor(bill({ recurrence: undefined }))).toBe(0);
  });
});

describe('buildSeriesUpdate', () => {
  const today = '2026-10-29';
  it('rebuilds only unpaid future occurrences when the amount changes', () => {
    const previous = bill();
    const existing = [
      occurrence({ id: 'bill-1_2026-09-18', originalDate: '2026-09-18', dueDate: '2026-09-18', state: 'paid' }),
      occurrence({ id: 'bill-1_2026-10-18', originalDate: '2026-10-18', dueDate: '2026-10-18' }),
      occurrence({ id: 'bill-1_2026-11-18', originalDate: '2026-11-18', dueDate: '2026-11-18' }),
    ];
    const changes = buildSeriesUpdate(previous, { ...previous, amountMinor: 250000 }, existing, today, NOW);
    const regenerated = changes.put?.billOccurrences ?? [];
    expect(regenerated.find((entry) => entry.id === 'bill-1_2026-11-18')?.amountMinor).toBe(250000);
    // Past (overdue) and paid occurrences are left alone.
    expect(regenerated.some((entry) => entry.id === 'bill-1_2026-10-18' || entry.id === 'bill-1_2026-09-18')).toBe(false);
    expect(changes.remove?.billOccurrences ?? []).toEqual([]);
  });

  it('removes future open occurrences that no longer fit a new schedule', () => {
    const previous = bill();
    const existing = [occurrence({ id: 'bill-1_2026-11-18', originalDate: '2026-11-18', dueDate: '2026-11-18' })];
    const changes = buildSeriesUpdate(previous, { ...previous, startDate: '2026-06-20' }, existing, today, NOW);
    expect(changes.remove?.billOccurrences).toEqual(['bill-1_2026-11-18']);
    expect((changes.put?.billOccurrences ?? []).some((entry) => entry.dueDate === '2026-11-20')).toBe(true);
  });

  it('only saves the bill when nothing affecting the schedule changed', () => {
    const previous = bill();
    expect(buildSeriesUpdate(previous, { ...previous, name: 'Power' }, [], today, NOW)).toEqual({ put: { bills: [{ ...previous, name: 'Power' }] } });
  });

  it('futureOpenOccurrences ignores paid and past entries', () => {
    const list = [
      occurrence({ id: 'a', originalDate: '2026-10-28' }),
      occurrence({ id: 'b', originalDate: '2026-10-29' }),
      occurrence({ id: 'c', originalDate: '2026-11-30', state: 'paid' }),
    ];
    expect(futureOpenOccurrences('bill-1', list, today).map((entry) => entry.id)).toEqual(['b']);
  });
});
