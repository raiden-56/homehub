import { describe, expect, it } from 'vitest';
import { setupHousehold } from '@/test/utils';
import { commitChanges } from '@/data/actions';
import { loadHousehold } from '@/data/db';
import { blobToDataUrl, buildBackup, dataUrlToBlob, parseBackup, restoreBackup } from '../backup';
import { deleteHousehold } from '@/features/household/lifecycle';
import { newId, nowIso } from '@/lib/ids';
import type { HouseholdDocument, InventoryItem } from '@/types/models';

async function toFile(blob: Blob, name = 'backup.json') {
  return new File([await blob.text()], name, { type: 'application/json' });
}

describe('backup and restore', () => {
  it('round-trips a household including document files', async () => {
    const h = await setupHousehold();
    const now = nowIso();
    const item: InventoryItem = {
      id: newId(), householdId: h.householdId, name: 'Rice', categoryId: h.categoryIds[0]!, locationId: h.locationIds[0]!,
      quantity: 3, unit: 'kg', minQuantity: 1, archived: false, createdAt: now, updatedAt: now,
    };
    const doc: HouseholdDocument = {
      id: newId(), householdId: h.householdId, title: 'Manual', category: 'Manual', fileName: 'manual.txt', mimeType: 'text/plain',
      size: 5, links: [], archived: false, uploadedBy: h.userId, createdAt: now, updatedAt: now,
    };
    await h.store.dispatch(
      commitChanges({ put: { inventoryItems: [item], documents: [doc] } }),
    );

    const backup = await buildBackup(h.store.getState(), h.householdId);
    const parsed = await parseBackup(await toFile(backup), h.store.getState());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.summary.existsLocally).toBe(true);
    expect(parsed.summary.counts.find((entry) => entry.label === 'Inventory items')?.count).toBe(1);

    // Delete the household, then restore it from the file.
    await h.store.dispatch(deleteHousehold(h.householdId));
    expect((await loadHousehold(h.householdId)).inventoryItems).toHaveLength(0);

    await h.store.dispatch(restoreBackup(parsed.backup));
    const restored = await loadHousehold(h.householdId);
    expect(restored.inventoryItems.map((entry) => entry.name)).toEqual(['Rice']);
    expect(restored.documents.map((entry) => entry.title)).toEqual(['Manual']);
    expect(h.store.getState().session.activeHouseholdId).toBe(h.householdId);
  });

  it('encodes document files losslessly', async () => {
    const bytes = new Uint8Array([0, 255, 128, 37, 10]);
    const url = await blobToDataUrl(new Blob([bytes], { type: 'application/pdf' }));
    expect(url.startsWith('data:application/pdf;base64,')).toBe(true);
    const back = await dataUrlToBlob(url);
    expect(back.type).toBe('application/pdf');
    expect([...new Uint8Array(await back.arrayBuffer())]).toEqual([...bytes]);
  });

  it('rejects files that are not valid backups, with specific errors', async () => {
    const h = await setupHousehold();
    const notJson = await parseBackup(new File(['nope'], 'x.json'), h.store.getState());
    expect(notJson).toMatchObject({ ok: false });

    const backup = JSON.parse(await (await buildBackup(h.store.getState(), h.householdId)).text());
    backup.collections.inventoryCategories[0].householdId = 'someone-else';
    const tampered = await parseBackup(new File([JSON.stringify(backup)], 'x.json'), h.store.getState());
    expect(tampered.ok).toBe(false);
    if (!tampered.ok) expect(tampered.errors[0]).toMatch(/different household/);
  });

  it('excludes invitation tokens from backups', async () => {
    const h = await setupHousehold();
    const text = await (await buildBackup(h.store.getState(), h.householdId)).text();
    expect(text).not.toContain('"token"');
  });
});
