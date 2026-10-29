import { describe, expect, it } from 'vitest';
import type { InventoryItem, InventoryMovement } from '@/types/models';
import {
  estimateConsumption,
  expiryStatus,
  matchesFilters,
  roundQuantity,
  sortItems,
  stockStatus,
  type InventoryFilterState,
} from '../logic';
import { csvCell, toCsv } from '../csv';

const TODAY = '2026-10-29';

function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    householdId: 'h1',
    name: 'Rice',
    categoryId: 'c1',
    locationId: 'l1',
    quantity: 5,
    unit: 'kg',
    minQuantity: 2,
    archived: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function consume(itemId: string, date: string, amount: number): InventoryMovement {
  return {
    id: `${itemId}-${date}-${amount}`,
    householdId: 'h1',
    itemId,
    type: 'consume',
    delta: -amount,
    quantityAfter: 0,
    actorId: 'u1',
    occurredAt: `${date}T12:00:00.000Z`,
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
  };
}

describe('stockStatus', () => {
  it('flags zero as out of stock', () => expect(stockStatus({ quantity: 0, minQuantity: 2 })).toBe('out'));
  it('flags quantities below the minimum as low', () => expect(stockStatus({ quantity: 1.5, minQuantity: 2 })).toBe('low'));
  it('treats the minimum itself as stocked', () => expect(stockStatus({ quantity: 2, minQuantity: 2 })).toBe('ok'));
  it('never flags low without a threshold', () => expect(stockStatus({ quantity: 0.1, minQuantity: 0 })).toBe('ok'));
});

describe('expiryStatus', () => {
  it('ignores items without an expiry date', () => expect(expiryStatus({}, TODAY)).toBe('none'));
  it('detects expired items', () => expect(expiryStatus({ expiryDate: '2026-10-28' }, TODAY)).toBe('expired'));
  it('detects items expiring within the warning period', () => {
    expect(expiryStatus({ expiryDate: '2026-10-29' }, TODAY, 5)).toBe('soon');
    expect(expiryStatus({ expiryDate: '2026-11-03' }, TODAY, 5)).toBe('soon');
    expect(expiryStatus({ expiryDate: '2026-11-04' }, TODAY, 5)).toBe('ok');
  });
  it('respects a configurable warning period', () => expect(expiryStatus({ expiryDate: '2026-11-08' }, TODAY, 14)).toBe('soon'));
});

describe('roundQuantity', () => {
  it('removes floating-point noise', () => expect(roundQuantity(0.1 + 0.2)).toBe(0.3));
});

describe('estimateConsumption', () => {
  it('needs at least three uses', () => {
    const rice = item({ id: 'rice' });
    const result = estimateConsumption(rice, [consume('rice', '2026-10-10', 1), consume('rice', '2026-10-20', 1)], TODAY, 'UTC');
    expect(result).toEqual({ kind: 'insufficient', events: 2 });
  });

  it('needs the uses to span at least a week', () => {
    const rice = item({ id: 'rice' });
    const movements = ['2026-10-25', '2026-10-26', '2026-10-27'].map((date) => consume('rice', date, 1));
    expect(estimateConsumption(rice, movements, TODAY, 'UTC').kind).toBe('insufficient');
  });

  it('ignores uses older than 60 days and other items', () => {
    const rice = item({ id: 'rice' });
    const movements = [
      consume('rice', '2026-07-01', 1),
      consume('rice', '2026-07-05', 1),
      consume('rice', '2026-07-09', 1),
      consume('dal', '2026-10-20', 1),
    ];
    expect(estimateConsumption(rice, movements, TODAY, 'UTC').kind).toBe('insufficient');
  });

  it('estimates the run-out date from the average daily use', () => {
    const rice = item({ id: 'rice', quantity: 4 });
    // 4 kg used over the 20 days since the first recorded use → 0.2 kg/day → 20 days left.
    const movements = [
      consume('rice', '2026-10-09', 1),
      consume('rice', '2026-10-15', 1),
      consume('rice', '2026-10-21', 1),
      consume('rice', '2026-10-27', 1),
    ];
    const result = estimateConsumption(rice, movements, TODAY, 'UTC');
    expect(result.kind).toBe('estimate');
    if (result.kind !== 'estimate') return;
    expect(result.dailyRate).toBeCloseTo(0.2);
    expect(result.daysLeft).toBeCloseTo(20);
    expect(result.runOutDate).toBe('2026-11-18');
  });

  it('reports items that are already out', () => {
    expect(estimateConsumption(item({ id: 'x', quantity: 0 }), [], TODAY, 'UTC')).toEqual({ kind: 'out' });
  });
});

describe('filtering and sorting', () => {
  const base: InventoryFilterState = { q: '', archived: false };
  const items = [
    item({ id: 'a', name: 'Milk', quantity: 1, minQuantity: 2, expiryDate: '2026-10-30', locationId: 'fridge' }),
    item({ id: 'b', name: 'Rice', quantity: 0, minQuantity: 1, purchaseDate: '2026-10-01' }),
    item({ id: 'c', name: 'Atta', quantity: 8, minQuantity: 3, purchaseDate: '2026-10-20', barcode: '8901234' }),
    item({ id: 'd', name: 'Old jam', archived: true, expiryDate: '2026-10-01' }),
  ];
  const run = (filters: Partial<InventoryFilterState>) =>
    items.filter((entry) => matchesFilters(entry, { ...base, ...filters }, TODAY, 5)).map((entry) => entry.id);

  it('hides archived items unless requested', () => {
    expect(run({})).toEqual(['a', 'b', 'c']);
    expect(run({ archived: true })).toEqual(['d']);
  });
  it('treats "low" as low or out, and "out" as zero only', () => {
    expect(run({ stock: 'low' })).toEqual(['a', 'b']);
    expect(run({ stock: 'out' })).toEqual(['b']);
  });
  it('filters by expiry and location', () => {
    expect(run({ expiry: 'soon' })).toEqual(['a']);
    expect(run({ location: 'fridge' })).toEqual(['a']);
  });
  it('searches names and barcodes', () => {
    expect(run({ q: 'mil' })).toEqual(['a']);
    expect(run({ q: '89012' })).toEqual(['c']);
  });
  it('sorts by name, quantity and dates (missing dates last)', () => {
    const active = items.slice(0, 3);
    expect(sortItems(active, 'name').map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
    expect(sortItems(active, 'quantity').map((entry) => entry.id)).toEqual(['b', 'a', 'c']);
    expect(sortItems(active, 'purchaseDate').map((entry) => entry.id)).toEqual(['c', 'b', 'a']);
    expect(sortItems(active, 'expiryDate').map((entry) => entry.id)[0]).toBe('a');
  });
});

describe('CSV export', () => {
  it('escapes quotes, commas and newlines', () => {
    expect(csvCell('Rice, basmati')).toBe('"Rice, basmati"');
    expect(csvCell('5" pan')).toBe('"5"" pan"');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
  });
  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell(-5)).toBe('-5');
  });
  it('joins rows with CRLF', () => {
    expect(toCsv([['a', 1], ['b', undefined]])).toBe('a,1\r\nb,');
  });
});
