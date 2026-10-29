import { describe, expect, it } from 'vitest';
import type { ShoppingItem } from '@/types/models';
import {
  defaultExpenseCategory,
  findDuplicate,
  parseLines,
  parseQuickAdd,
  quickAddSuggestions,
  summariseList,
} from '../logic';

function shoppingItem(overrides: Partial<ShoppingItem>): ShoppingItem {
  return {
    id: Math.random().toString(36).slice(2),
    householdId: 'h1',
    listId: 'list',
    name: 'Milk',
    quantity: 1,
    unit: 'L',
    priority: 'normal',
    purchased: false,
    addedBy: 'u1',
    sortOrder: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('parseQuickAdd', () => {
  it.each([
    ['2 kg rice', { quantity: 2, unit: 'kg', name: 'Rice' }],
    ['1.5L milk', { quantity: 1.5, unit: 'L', name: 'Milk' }],
    ['1,5 litres oil', { quantity: 1.5, unit: 'L', name: 'Oil' }],
    ['6 eggs', { quantity: 6, unit: 'pcs', name: 'Eggs' }],
    ['2 ripe mangoes', { quantity: 2, unit: 'pcs', name: 'Ripe mangoes' }],
    ['bread', { quantity: 1, unit: 'pcs', name: 'Bread' }],
    ['  coriander   leaves ', { quantity: 1, unit: 'pcs', name: 'Coriander leaves' }],
    ['3 packets biscuits', { quantity: 3, unit: 'pack', name: 'Biscuits' }],
  ])('parses “%s”', (input, expected) => {
    expect(parseQuickAdd(input)).toEqual(expected);
  });

  it('treats text that is not "amount + item" as a name', () => {
    expect(parseQuickAdd('7up')).toEqual({ quantity: 1, unit: 'pcs', name: '7up' });
    expect(parseQuickAdd('2 kg')).toEqual({ quantity: 1, unit: 'pcs', name: '2 kg' });
    expect(parseQuickAdd('12')).toEqual({ quantity: 1, unit: 'pcs', name: '12' });
  });

  it('returns null for blank input', () => expect(parseQuickAdd('   ')).toBeNull());

  it('parses one item per line, skipping blanks and bullets', () => {
    expect(parseLines('- 2 L milk\n\n• eggs\n1 kg tomatoes')).toEqual([
      { quantity: 2, unit: 'L', name: 'Milk' },
      { quantity: 1, unit: 'pcs', name: 'Eggs' },
      { quantity: 1, unit: 'kg', name: 'Tomatoes' },
    ]);
  });
});

describe('findDuplicate', () => {
  const items = [
    shoppingItem({ id: 'milk', name: 'Milk', inventoryItemId: 'inv-milk' }),
    shoppingItem({ id: 'eggs', name: 'Eggs', purchased: true }),
    shoppingItem({ id: 'bread', name: 'Bread', clearedAt: '2026-10-02T00:00:00.000Z' }),
    shoppingItem({ id: 'other', name: 'Rice', listId: 'other-list' }),
  ];

  it('matches pending items by name, ignoring case and spaces', () => {
    expect(findDuplicate(items, 'list', { name: '  milk ' })?.id).toBe('milk');
  });
  it('matches by linked inventory item even when the name differs', () => {
    expect(findDuplicate(items, 'list', { name: 'Toned milk', inventoryItemId: 'inv-milk' })?.id).toBe('milk');
  });
  it('ignores purchased, cleared and other lists’ items', () => {
    expect(findDuplicate(items, 'list', { name: 'Eggs' })).toBeUndefined();
    expect(findDuplicate(items, 'list', { name: 'Bread' })).toBeUndefined();
    expect(findDuplicate(items, 'list', { name: 'Rice' })).toBeUndefined();
  });
});

describe('list summaries and suggestions', () => {
  it('counts remaining items and sums estimates of what is still to buy', () => {
    const items = [
      shoppingItem({ estimatedPriceMinor: 6800 }),
      shoppingItem({ name: 'Eggs', estimatedPriceMinor: 9000 }),
      shoppingItem({ name: 'Bread' }),
      shoppingItem({ name: 'Tea', purchased: true, estimatedPriceMinor: 27500 }),
      shoppingItem({ name: 'Old', purchased: true, clearedAt: '2026-10-02T00:00:00.000Z' }),
    ];
    expect(summariseList(items, 'list')).toEqual({ remaining: 3, purchased: 1, estimatedTotalMinor: 15800, hasEstimate: true });
  });

  it('ranks suggestions by how often they are bought', () => {
    const items = [
      shoppingItem({ name: 'Milk', purchased: true }),
      shoppingItem({ name: 'milk', purchased: true }),
      shoppingItem({ name: 'Eggs' }),
    ];
    expect(quickAddSuggestions(items, ['Rice', 'Eggs'])).toEqual(['Milk', 'Eggs', 'Rice']);
  });

  it('maps cleaning and paper categories to household supplies', () => {
    expect(defaultExpenseCategory('Cleaning supplies')).toBe('Household supplies');
    expect(defaultExpenseCategory('Paper products')).toBe('Household supplies');
    expect(defaultExpenseCategory('Dairy & eggs')).toBe('Groceries');
    expect(defaultExpenseCategory(undefined)).toBe('Groceries');
  });
});
