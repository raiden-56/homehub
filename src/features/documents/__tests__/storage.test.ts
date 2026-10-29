import { describe, expect, it } from 'vitest';
import { commitChanges } from '@/data/actions';
import { getDocumentBlob, getRecord } from '@/data/db';
import { setupHousehold } from '@/test/utils';
import type { Bill, HouseholdDocument } from '@/types/models';
import { documentDeletionChanges } from '../changes';

describe('document storage', () => {
  it('stores the file with the record and removes both on delete, clearing references', async () => {
    const h = await setupHousehold();
    const now = new Date().toISOString();
    const document: HouseholdDocument = {
      id: 'doc-1',
      householdId: h.householdId,
      title: 'Rental agreement',
      category: 'Agreement',
      fileName: 'agreement.txt',
      mimeType: 'text/plain',
      size: 11,
      links: [{ type: 'bill', id: 'bill-1' }],
      archived: false,
      uploadedBy: h.userId,
      createdAt: now,
      updatedAt: now,
    };
    const bill: Bill = {
      id: 'bill-1',
      householdId: h.householdId,
      name: 'Rent',
      category: 'Rent',
      amountMinor: 2800000,
      startDate: '2026-10-05',
      active: true,
      documentId: 'doc-1',
      createdAt: now,
      updatedAt: now,
    };
    await h.seed({ put: { bills: [bill] } });

    await h.store.dispatch(
      commitChanges(
        { put: { documents: [document] } },
        { blobs: { put: [{ id: document.id, householdId: h.householdId, blob: new Blob(['hello world'], { type: 'text/plain' }) }] } },
      ),
    );
    expect(await getDocumentBlob('doc-1')).toBeDefined();
    expect(h.store.getState().data.documents['doc-1']?.title).toBe('Rental agreement');

    const changes = documentDeletionChanges(document, h.store.getState().data, new Date().toISOString());
    await h.store.dispatch(commitChanges(changes, { blobs: { remove: ['doc-1'] } }));

    expect(await getDocumentBlob('doc-1')).toBeUndefined();
    expect(await getRecord('documents', 'doc-1')).toBeUndefined();
    expect((await getRecord('bills', 'bill-1'))?.documentId).toBeUndefined();
    expect(h.store.getState().data.documents['doc-1']).toBeUndefined();
  });
});
