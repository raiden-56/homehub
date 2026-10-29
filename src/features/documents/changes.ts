import type { ChangeSet } from '@/data/collections';
import type { Tables } from '@/store/dataSlice';
import type { HouseholdDocument } from '@/types/models';

/**
 * Removes a document and clears every reference to it (bill attachment, expense receipt,
 * maintenance task/record attachments) so no record points at a missing file. The stored blob
 * must be removed in the same commit via `blobs.remove`.
 */
export function documentDeletionChanges(document: HouseholdDocument, data: Tables, now: string): ChangeSet {
  const id = document.id;
  const bills = Object.values(data.bills)
    .filter((bill) => bill.documentId === id)
    .map((bill) => ({ ...bill, documentId: undefined, updatedAt: now }));
  const expenses = Object.values(data.expenses)
    .filter((expense) => expense.receiptDocumentId === id)
    .map((expense) => ({ ...expense, receiptDocumentId: undefined, updatedAt: now }));
  const maintenanceTasks = Object.values(data.maintenanceTasks)
    .filter((task) => task.documentIds.includes(id))
    .map((task) => ({ ...task, documentIds: task.documentIds.filter((value) => value !== id), updatedAt: now }));
  const maintenanceRecords = Object.values(data.maintenanceRecords)
    .filter((record) => record.documentIds.includes(id))
    .map((record) => ({ ...record, documentIds: record.documentIds.filter((value) => value !== id), updatedAt: now }));
  return {
    put: {
      ...(bills.length ? { bills } : {}),
      ...(expenses.length ? { expenses } : {}),
      ...(maintenanceTasks.length ? { maintenanceTasks } : {}),
      ...(maintenanceRecords.length ? { maintenanceRecords } : {}),
    },
    remove: { documents: [id] },
  };
}
