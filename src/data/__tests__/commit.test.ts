import { describe, expect, it } from 'vitest';
import { commitChanges, switchHousehold } from '@/data/actions';
import { getRecord, loadHousehold } from '@/data/db';
import { DuplicateOperationError, PermissionError, TenantIsolationError } from '@/data/errors';
import { setupHousehold } from '@/test/utils';
import { buildNewHousehold } from '@/features/household/factory';
import type { InventoryItem } from '@/types/models';
import { newId } from '@/lib/ids';

function item(householdId: string, categoryId: string, locationId: string, name = 'Rice'): InventoryItem {
  const now = new Date().toISOString();
  return {
    id: newId(),
    householdId,
    name,
    categoryId,
    locationId,
    quantity: 2,
    unit: 'kg',
    minQuantity: 1,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
}

describe('commitChanges', () => {
  it('persists records and applies them to the store', async () => {
    const h = await setupHousehold();
    const record = item(h.householdId, h.categoryIds[0]!, h.locationIds[0]!);
    await h.store.dispatch(commitChanges({ put: { inventoryItems: [record] } }, { activity: { entity: 'inventory', message: 'Added Rice' } }));
    expect(h.store.getState().data.inventoryItems[record.id]?.name).toBe('Rice');
    expect(await getRecord('inventoryItems', record.id)).toMatchObject({ name: 'Rice' });
    const activity = Object.values(h.store.getState().data.activity);
    expect(activity.some((entry) => entry.message === 'Added Rice' && entry.actorId === h.userId)).toBe(true);
  });

  it('rejects changes from viewers', async () => {
    const h = await setupHousehold({ role: 'viewer' });
    const record = item(h.householdId, h.categoryIds[0]!, h.locationIds[0]!);
    await expect(h.store.dispatch(commitChanges({ put: { inventoryItems: [record] } }))).rejects.toBeInstanceOf(PermissionError);
    expect(await getRecord('inventoryItems', record.id)).toBeUndefined();
  });

  it('lets members edit but not manage members', async () => {
    const h = await setupHousehold({ role: 'member' });
    await expect(
      h.store.dispatch(commitChanges({ put: { inventoryItems: [item(h.householdId, h.categoryIds[0]!, h.locationIds[0]!)] } })),
    ).resolves.toBeUndefined();
    const household = h.store.getState().data.households[h.householdId]!;
    await expect(
      h.store.dispatch(commitChanges({ put: { households: [{ ...household, name: 'Renamed' }] } }, { action: 'manageHousehold' })),
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it('blocks writes that target another household', async () => {
    const h = await setupHousehold();
    const foreign = item('some-other-household', h.categoryIds[0]!, h.locationIds[0]!);
    await expect(h.store.dispatch(commitChanges({ put: { inventoryItems: [foreign] } }))).rejects.toBeInstanceOf(TenantIsolationError);
    expect(await getRecord('inventoryItems', foreign.id)).toBeUndefined();
  });

  it('refuses to overwrite a record owned by another household even with a matching id', async () => {
    const a = await setupHousehold({ name: 'Alice' });
    const b = await setupHousehold({ name: 'Bob' });
    const secret = item(a.householdId, a.categoryIds[0]!, a.locationIds[0]!, 'Alice secret');
    await a.store.dispatch(commitChanges({ put: { inventoryItems: [secret] } }));
    // Bob crafts a record with Alice's id but his own household id.
    const hijack = { ...secret, householdId: b.householdId, name: 'Hijacked' };
    await expect(b.store.dispatch(commitChanges({ put: { inventoryItems: [hijack] } }))).rejects.toBeInstanceOf(TenantIsolationError);
    expect((await getRecord('inventoryItems', secret.id))?.name).toBe('Alice secret');
  });

  it('applies an idempotent operation only once', async () => {
    const h = await setupHousehold();
    const first = item(h.householdId, h.categoryIds[0]!, h.locationIds[0]!);
    const second = item(h.householdId, h.categoryIds[0]!, h.locationIds[0]!);
    await h.store.dispatch(commitChanges({ put: { inventoryItems: [first] } }, { idempotencyKey: 'receive:abc' }));
    await expect(
      h.store.dispatch(commitChanges({ put: { inventoryItems: [second] } }, { idempotencyKey: 'receive:abc' })),
    ).rejects.toBeInstanceOf(DuplicateOperationError);
    expect(await getRecord('inventoryItems', second.id)).toBeUndefined();
  });

  it('is atomic: a failing write leaves no partial records', async () => {
    const h = await setupHousehold();
    const good = item(h.householdId, h.categoryIds[0]!, h.locationIds[0]!);
    await h.store.dispatch(commitChanges({ put: { inventoryItems: [good] } }, { idempotencyKey: 'op-1' }));
    const another = item(h.householdId, h.categoryIds[0]!, h.locationIds[0]!);
    await expect(
      h.store.dispatch(commitChanges({ put: { inventoryItems: [another] } }, { idempotencyKey: 'op-1' })),
    ).rejects.toThrow();
    const snapshot = await loadHousehold(h.householdId);
    expect(snapshot.inventoryItems.map((entry) => entry.id)).toEqual([good.id]);
  });

  it('only opens households the profile belongs to, and never mixes their data', async () => {
    const h = await setupHousehold();
    const mine = item(h.householdId, h.categoryIds[0]!, h.locationIds[0]!, 'Mine');
    await h.store.dispatch(commitChanges({ put: { inventoryItems: [mine] } }));

    const other = await setupHousehold({ name: 'Stranger' });
    await expect(h.store.dispatch(switchHousehold(other.householdId))).rejects.toBeInstanceOf(PermissionError);

    // Create a second household for the same profile and switch to it.
    const now = new Date().toISOString();
    const second = buildNewHousehold({ name: 'Cabin', type: 'couple', currency: 'INR', timeZone: 'Asia/Kolkata' }, h.userId, now);
    await h.store.dispatch(commitChanges(second.changes, { flow: 'createHousehold', householdId: second.household.id }));
    await h.store.dispatch(switchHousehold(second.household.id));
    const state = h.store.getState();
    expect(state.session.activeHouseholdId).toBe(second.household.id);
    expect(Object.values(state.data.inventoryItems)).toHaveLength(0);
    expect(Object.values(state.data.inventoryCategories).every((category) => category.householdId === second.household.id)).toBe(true);

    await h.store.dispatch(switchHousehold(h.householdId));
    expect(Object.values(h.store.getState().data.inventoryItems).map((entry) => entry.name)).toEqual(['Mine']);
  });
});
