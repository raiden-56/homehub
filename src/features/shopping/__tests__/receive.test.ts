import { describe, expect, it } from 'vitest';
import { commitChanges } from '@/data/actions';
import { DuplicateOperationError } from '@/data/errors';
import { loadHousehold } from '@/data/db';
import { setupHousehold } from '@/test/utils';
import type { InventoryItem, ShoppingItem, ShoppingList } from '@/types/models';
import { newId } from '@/lib/ids';
import { buildReceivePurchase } from '../logic';

const NOW = '2026-10-29T10:00:00.000Z';
const TODAY = '2026-10-29';

async function fixture() {
  const h = await setupHousehold();
  const list: ShoppingList = {
    id: newId(),
    householdId: h.householdId,
    name: 'Weekly Groceries',
    archived: false,
    createdBy: h.userId,
    lastActivityAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const milk: InventoryItem = {
    id: newId(),
    householdId: h.householdId,
    name: 'Milk',
    categoryId: h.categoryIds[2]!,
    locationId: h.locationIds[1]!,
    quantity: 1,
    unit: 'L',
    minQuantity: 2,
    archived: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const entry: ShoppingItem = {
    id: newId(),
    householdId: h.householdId,
    listId: list.id,
    name: 'Milk',
    quantity: 2,
    unit: 'L',
    inventoryItemId: milk.id,
    priority: 'normal',
    purchased: true,
    purchasedAt: NOW,
    purchasedBy: h.userId,
    addedBy: h.userId,
    sortOrder: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
  await h.seed({ put: { shoppingLists: [list], inventoryItems: [milk], shoppingItems: [entry] } });
  return { h, list, milk, entry };
}

describe('buildReceivePurchase', () => {
  it('updates inventory, records a purchase movement and an expense in one change set', async () => {
    const { h, list, milk, entry } = await fixture();
    const result = buildReceivePurchase({
      shoppingItem: entry,
      list,
      actorId: h.userId,
      now: NOW,
      today: TODAY,
      actualPriceMinor: 13600,
      quantity: 2,
      inventory: { mode: 'existing', item: milk },
      expense: { category: 'Groceries', payerId: h.userId },
    });
    expect(result.idempotencyKey).toBe(`receive:${entry.id}`);
    expect(result.changes.put?.inventoryItems?.[0]).toMatchObject({ id: milk.id, quantity: 3, purchasePriceMinor: 13600, purchaseDate: TODAY });
    const movement = result.changes.put?.inventoryMovements?.[0];
    expect(movement).toMatchObject({ itemId: milk.id, type: 'purchase', delta: 2, quantityAfter: 3, sourceShoppingItemId: entry.id });
    const expense = result.changes.put?.expenses?.[0];
    expect(expense).toMatchObject({ amountMinor: 13600, source: 'shopping', sourceId: entry.id, category: 'Groceries', date: TODAY });
    expect(result.changes.put?.shoppingItems?.[0]).toMatchObject({
      receivedAt: NOW,
      actualPriceMinor: 13600,
      receivedMovementId: movement?.id,
      expenseId: expense?.id,
    });
    expect(result.summary).toEqual(['Inventory: Milk 1 → 3 L', 'Expense: Groceries']);
  });

  it('can create a new inventory item and split the expense exactly', async () => {
    const { h, list, entry } = await fixture();
    const result = buildReceivePurchase({
      shoppingItem: { ...entry, inventoryItemId: undefined, name: 'Paneer' },
      list,
      actorId: h.userId,
      now: NOW,
      today: TODAY,
      actualPriceMinor: 10000,
      quantity: 1,
      inventory: { mode: 'new', name: 'Paneer', categoryId: h.categoryIds[2]!, locationId: h.locationIds[1]!, unit: 'pcs', minQuantity: 0 },
      expense: { category: 'Groceries', payerId: h.userId, splitWith: ['a', 'b', 'c'] },
    });
    const created = result.changes.put?.inventoryItems?.[0];
    expect(created).toMatchObject({ name: 'Paneer', quantity: 1 });
    expect(result.changes.put?.shoppingItems?.[0]?.inventoryItemId).toBe(created?.id);
    const shares = result.changes.put?.expenses?.[0]?.split?.shares.map((share) => share.shareMinor);
    expect(shares).toEqual([3334, 3333, 3333]);
  });

  it('refuses an already received item and an expense without a price', async () => {
    const { h, list, entry } = await fixture();
    const base = { list, actorId: h.userId, now: NOW, today: TODAY, quantity: 1, inventory: { mode: 'none' as const } };
    expect(() => buildReceivePurchase({ ...base, shoppingItem: { ...entry, receivedAt: NOW } })).toThrow(/already/);
    expect(() =>
      buildReceivePurchase({ ...base, shoppingItem: entry, expense: { category: 'Groceries', payerId: h.userId } }),
    ).toThrow(/price/);
  });

  it('applies only once even if the same receive is dispatched twice', async () => {
    const { h, list, milk, entry } = await fixture();
    const build = () =>
      buildReceivePurchase({
        shoppingItem: entry,
        list,
        actorId: h.userId,
        now: NOW,
        today: TODAY,
        actualPriceMinor: 13600,
        quantity: 2,
        inventory: { mode: 'existing', item: milk },
        expense: { category: 'Groceries', payerId: h.userId },
      });
    const first = build();
    const second = build();
    await h.store.dispatch(commitChanges(first.changes, { idempotencyKey: first.idempotencyKey }));
    await expect(
      h.store.dispatch(commitChanges(second.changes, { idempotencyKey: second.idempotencyKey })),
    ).rejects.toBeInstanceOf(DuplicateOperationError);

    const snapshot = await loadHousehold(h.householdId);
    expect(snapshot.inventoryItems.find((entryItem) => entryItem.id === milk.id)?.quantity).toBe(3);
    expect(snapshot.inventoryMovements.filter((movement) => movement.sourceShoppingItemId === entry.id)).toHaveLength(1);
    expect(snapshot.expenses.filter((expense) => expense.sourceId === entry.id)).toHaveLength(1);
    const state = h.store.getState().data;
    expect(Object.values(state.expenses)).toHaveLength(1);
    expect(state.inventoryItems[milk.id]?.quantity).toBe(3);
  });
});
