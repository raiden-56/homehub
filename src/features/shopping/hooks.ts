import { useCallback } from 'react';
import { useActiveHousehold, useAppSelector, useCommit, useCurrentUser } from '@/app/hooks';
import { useToast } from '@/components/feedback/ToastProvider';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { selectList } from '@/store/selectors';
import type { ShoppingItem, ShoppingList } from '@/types/models';
import { newId, nowIso } from '@/lib/ids';
import { defaultList, findDuplicate, nextSortOrder } from './logic';

export interface AddToListEntry {
  name: string;
  quantity?: number;
  unit: string;
  categoryId?: string;
  inventoryItemId?: string;
}

export function touchList(list: ShoppingList, now = nowIso()): ShoppingList {
  return { ...list, lastActivityAt: now, updatedAt: now };
}

export function newListRecord(householdId: string, name: string, createdBy: string, now = nowIso()): ShoppingList {
  return { id: newId(), householdId, name: name.trim(), archived: false, createdBy, lastActivityAt: now, createdAt: now, updatedAt: now };
}

/**
 * Adds items to a shopping list, skipping anything already pending on that list (same inventory
 * item or same name). Without `listId` the most recently active list is used, or a new
 * "Shopping list" is created.
 */
export function useAddToShoppingList() {
  const household = useActiveHousehold();
  const user = useCurrentUser();
  const lists = useAppSelector(selectList('shoppingLists'));
  const items = useAppSelector(selectList('shoppingItems'));
  const commit = useCommit();
  const toast = useToast();

  return useCallback(
    async (entries: AddToListEntry[], listId?: string): Promise<{ added: number; skipped: number; listId: string } | null> => {
      if (!household || !user || entries.length === 0) return null;
      const now = nowIso();
      let list = listId ? lists.find((entry) => entry.id === listId) : defaultList(lists);
      const created = !list;
      if (!list) list = newListRecord(household.id, 'Shopping list', user.id, now);

      const toAdd: ShoppingItem[] = [];
      let skipped = 0;
      let order = nextSortOrder(items, list.id);
      for (const entry of entries) {
        const pool = [...items, ...toAdd];
        if (findDuplicate(pool, list.id, entry)) {
          skipped += 1;
          continue;
        }
        toAdd.push({
          id: newId(),
          householdId: household.id,
          listId: list.id,
          name: entry.name.trim(),
          quantity: entry.quantity && entry.quantity > 0 ? entry.quantity : 1,
          unit: entry.unit,
          categoryId: entry.categoryId,
          inventoryItemId: entry.inventoryItemId,
          priority: 'normal',
          purchased: false,
          addedBy: user.id,
          sortOrder: order,
          createdAt: now,
          updatedAt: now,
        });
        order += 1;
      }

      if (toAdd.length === 0) {
        toast.show({
          message: skipped === 1 ? `Already on ${list.name}` : `All ${skipped} items are already on ${list.name}`,
          severity: 'info',
        });
        return { added: 0, skipped, listId: list.id };
      }

      const skippedText = skipped > 0 ? ` · ${skipped} already on the list` : '';
      const ok = await commit(
        { put: { shoppingLists: [touchList(list, now)], shoppingItems: toAdd } },
        {
          success: `Added ${toAdd.length === 1 ? `“${toAdd[0]!.name}”` : `${toAdd.length} items`} to ${list.name}${skippedText}`,
          undo: created
            ? { remove: { shoppingLists: [list.id], shoppingItems: toAdd.map((item) => item.id) } }
            : { remove: { shoppingItems: toAdd.map((item) => item.id) } },
          activity: toAdd.map((item) => ({ entity: 'shopping' as const, entityId: list.id, message: `Added “${item.name}” to ${list.name}` })),
        },
      );
      return ok ? { added: toAdd.length, skipped, listId: list.id } : null;
    },
    [household, user, lists, items, commit, toast],
  );
}

/** Everyday item actions on a list. Each also refreshes the list's last-activity time. */
export function useShoppingItemActions(list: ShoppingList | undefined) {
  const commit = useCommit();
  const confirm = useConfirm();
  const user = useCurrentUser();

  const togglePurchased = useCallback(
    async (item: ShoppingItem) => {
      if (!list || !user) return false;
      const now = nowIso();
      if (item.purchased && item.receivedAt) {
        await confirm({
          title: 'This purchase was already recorded',
          description:
            'HomeHub already added it to inventory and/or expenses, so it can’t be unticked here. Adjust the stock from Inventory or edit the expense from Bills & Expenses instead.',
          confirmLabel: 'OK',
          cancelLabel: 'Close',
        });
        return false;
      }
      const next: ShoppingItem = item.purchased
        ? { ...item, purchased: false, purchasedAt: undefined, purchasedBy: undefined, updatedAt: now }
        : { ...item, purchased: true, purchasedAt: now, purchasedBy: user.id, updatedAt: now };
      return commit(
        { put: { shoppingItems: [next], shoppingLists: [touchList(list, now)] } },
        {
          activity: {
            entity: 'shopping',
            entityId: list.id,
            message: next.purchased ? `Bought “${item.name}” from ${list.name}` : `Moved “${item.name}” back to ${list.name}`,
          },
        },
      );
    },
    [list, user, commit, confirm],
  );

  const changeQuantity = useCallback(
    async (item: ShoppingItem, quantity: number) => {
      if (!list || quantity <= 0) return false;
      const now = nowIso();
      return commit({ put: { shoppingItems: [{ ...item, quantity, updatedAt: now }], shoppingLists: [touchList(list, now)] } });
    },
    [list, commit],
  );

  const remove = useCallback(
    async (item: ShoppingItem) => {
      if (!list) return false;
      if (item.receivedAt) {
        const ok = await confirm({
          title: `Remove “${item.name}”?`,
          description: 'Its inventory update and expense stay recorded; only the shopping entry is removed.',
          confirmLabel: 'Remove',
          destructive: true,
        });
        if (!ok) return false;
      }
      return commit(
        { remove: { shoppingItems: [item.id] }, put: { shoppingLists: [touchList(list)] } },
        {
          success: `Removed “${item.name}”`,
          undo: { put: { shoppingItems: [item] } },
          activity: { entity: 'shopping', entityId: list.id, message: `Removed “${item.name}” from ${list.name}` },
        },
      );
    },
    [list, commit, confirm],
  );

  const clearCompleted = useCallback(
    async (items: ShoppingItem[]) => {
      if (!list) return false;
      const done = items.filter((item) => item.listId === list.id && item.purchased && !item.clearedAt);
      if (done.length === 0) return false;
      const unreceived = done.filter((item) => !item.receivedAt).length;
      const ok = await confirm({
        title: `Clear ${done.length} purchased item${done.length === 1 ? '' : 's'}?`,
        description: `They’ll be hidden from this list but kept in purchase history.${
          unreceived > 0 ? ` ${unreceived} of them haven’t been recorded in inventory or expenses — you can still record them from purchase history.` : ''
        }`,
        confirmLabel: 'Clear completed',
      });
      if (!ok) return false;
      const now = nowIso();
      return commit(
        { put: { shoppingItems: done.map((item) => ({ ...item, clearedAt: now, updatedAt: now })), shoppingLists: [touchList(list, now)] } },
        {
          success: `Cleared ${done.length} item${done.length === 1 ? '' : 's'}`,
          undo: { put: { shoppingItems: done } },
          activity: { entity: 'shopping', entityId: list.id, message: `Cleared ${done.length} purchased items from ${list.name}` },
        },
      );
    },
    [list, commit, confirm],
  );

  return { togglePurchased, changeQuantity, remove, clearCompleted };
}
