import { useCallback } from 'react';
import { useCollection, useCommit, useCurrentUser } from '@/app/hooks';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import type { ShoppingItem, ShoppingList } from '@/types/models';
import { newId, nowIso } from '@/lib/ids';
import { newListRecord } from './hooks';
import { isPending } from './logic';

/** Duplicate, archive and delete for whole shopping lists. */
export function useListActions() {
  const commit = useCommit();
  const confirm = useConfirm();
  const user = useCurrentUser();
  const items = useCollection('shoppingItems');
  const lists = useCollection('shoppingLists');

  const duplicate = useCallback(
    async (list: ShoppingList): Promise<string | null> => {
      if (!user) return null;
      const now = nowIso();
      let name = `${list.name} (copy)`;
      for (let n = 2; lists.some((entry) => entry.name === name); n += 1) name = `${list.name} (copy ${n})`;
      const copy = newListRecord(list.householdId, name, user.id, now);
      const copied: ShoppingItem[] = items
        .filter((item) => item.listId === list.id && isPending(item))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item, index) => ({
          ...item,
          id: newId(),
          listId: copy.id,
          addedBy: user.id,
          sortOrder: index + 1,
          purchased: false,
          purchasedAt: undefined,
          purchasedBy: undefined,
          actualPriceMinor: undefined,
          receivedAt: undefined,
          receivedMovementId: undefined,
          expenseId: undefined,
          clearedAt: undefined,
          createdAt: now,
          updatedAt: now,
        }));
      const ok = await commit(
        { put: { shoppingLists: [copy], shoppingItems: copied } },
        {
          success: `Created “${name}” with ${copied.length} item${copied.length === 1 ? '' : 's'}`,
          undo: { remove: { shoppingLists: [copy.id], shoppingItems: copied.map((item) => item.id) } },
          activity: { entity: 'shopping', entityId: copy.id, message: `Duplicated “${list.name}” as “${name}”` },
        },
      );
      return ok ? copy.id : null;
    },
    [user, lists, items, commit],
  );

  const setArchived = useCallback(
    (list: ShoppingList, archived: boolean) => {
      const now = nowIso();
      return commit(
        { put: { shoppingLists: [{ ...list, archived, lastActivityAt: now, updatedAt: now }] } },
        {
          success: archived ? `Archived “${list.name}”` : `Restored “${list.name}”`,
          undo: { put: { shoppingLists: [list] } },
          activity: { entity: 'shopping', entityId: list.id, message: `${archived ? 'Archived' : 'Restored'} the list “${list.name}”` },
        },
      );
    },
    [commit],
  );

  const remove = useCallback(
    async (list: ShoppingList) => {
      const listItems = items.filter((item) => item.listId === list.id);
      const ok = await confirm({
        title: `Delete “${list.name}”?`,
        description: `The list and its ${listItems.length} item${listItems.length === 1 ? '' : 's'} (including purchase history) will be removed. Inventory updates and expenses already recorded are kept. Archive the list instead to keep its history.`,
        confirmLabel: 'Delete list',
        destructive: true,
      });
      if (!ok) return false;
      return commit(
        { remove: { shoppingLists: [list.id], shoppingItems: listItems.map((item) => item.id) } },
        { success: `Deleted “${list.name}”`, activity: { entity: 'shopping', message: `Deleted the list “${list.name}”` } },
      );
    },
    [items, confirm, commit],
  );

  return { duplicate, setArchived, remove };
}
