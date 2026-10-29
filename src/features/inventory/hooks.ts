import { useCallback, useMemo } from 'react';
import { useAppSelector, useCollection, useCommit, useCurrentUser } from '@/app/hooks';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { selectCurrentPreferences } from '@/store/selectors';
import type { InventoryItem, InventoryMovement, InventoryMovementType } from '@/types/models';
import { newId, nowIso } from '@/lib/ids';
import { DEFAULT_EXPIRY_WARNING_DAYS, roundQuantity } from './logic';

export function useTaxonomy() {
  const categories = useCollection('inventoryCategories');
  const locations = useCollection('inventoryLocations');
  return useMemo(() => {
    const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));
    const sortedLocations = [...locations].sort((a, b) => a.name.localeCompare(b.name));
    return {
      categories: sortedCategories,
      locations: sortedLocations,
      categoryById: new Map(sortedCategories.map((category) => [category.id, category])),
      locationById: new Map(sortedLocations.map((location) => [location.id, location])),
    };
  }, [categories, locations]);
}

/** Expiry warning period (days) from the current member's notification preferences. */
export function useExpiryLeadDays(): number {
  const preferences = useAppSelector(selectCurrentPreferences);
  return preferences?.notifications.expiryLeadDays ?? DEFAULT_EXPIRY_WARNING_DAYS;
}

/** Builds the updated item and the movement that records a quantity change. */
export function buildQuantityChange(
  item: InventoryItem,
  nextQuantity: number,
  type: InventoryMovementType,
  actorId: string,
  note?: string,
): { item: InventoryItem; movement: InventoryMovement } {
  const now = nowIso();
  const quantityAfter = roundQuantity(nextQuantity);
  return {
    item: { ...item, quantity: quantityAfter, updatedAt: now },
    movement: {
      id: newId(),
      householdId: item.householdId,
      itemId: item.id,
      type,
      delta: roundQuantity(quantityAfter - item.quantity),
      quantityAfter,
      note: note?.trim() || undefined,
      actorId,
      occurredAt: now,
      createdAt: now,
      updatedAt: now,
    },
  };
}

/** Archive, restore and delete actions shared by the list, bulk bar and detail drawer. */
export function useInventoryActions() {
  const commit = useCommit();
  const confirm = useConfirm();
  const user = useCurrentUser();
  const movements = useCollection('inventoryMovements');

  const setArchived = useCallback(
    async (items: InventoryItem[], archived: boolean) => {
      if (items.length === 0) return false;
      const now = nowIso();
      const label = items.length === 1 ? `“${items[0]!.name}”` : `${items.length} items`;
      return commit(
        { put: { inventoryItems: items.map((item) => ({ ...item, archived, updatedAt: now })) } },
        {
          success: archived ? `Archived ${label}` : `Restored ${label}`,
          undo: { put: { inventoryItems: items } },
          activity: items.map((item) => ({
            entity: 'inventory' as const,
            entityId: item.id,
            message: `${archived ? 'Archived' : 'Restored'} “${item.name}”`,
          })),
        },
      );
    },
    [commit],
  );

  const remove = useCallback(
    async (items: InventoryItem[]) => {
      if (items.length === 0 || !user) return false;
      const label = items.length === 1 ? `“${items[0]!.name}”` : `${items.length} items`;
      const ok = await confirm({
        title: `Delete ${label}?`,
        description:
          'The item and its stock history will be permanently removed. Expenses and shopping lists are not affected. To keep the history, archive it instead.',
        confirmLabel: 'Delete',
        destructive: true,
      });
      if (!ok) return false;
      const ids = new Set(items.map((item) => item.id));
      return commit(
        {
          remove: {
            inventoryItems: [...ids],
            inventoryMovements: movements.filter((movement) => ids.has(movement.itemId)).map((movement) => movement.id),
          },
        },
        {
          success: `Deleted ${label}`,
          activity: items.map((item) => ({ entity: 'inventory' as const, message: `Deleted “${item.name}”` })),
        },
      );
    },
    [commit, confirm, movements, user],
  );

  return { archive: (items: InventoryItem[]) => setArchived(items, true), restore: (items: InventoryItem[]) => setArchived(items, false), remove };
}
