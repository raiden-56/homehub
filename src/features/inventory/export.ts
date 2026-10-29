import type { InventoryCategory, InventoryItem, InventoryLocation } from '@/types/models';
import { minorToInput } from '@/lib/money';
import { downloadTextFile, toCsv } from './csv';
import { stockStatus, STOCK_LABELS } from './logic';

/** Builds CSV text for the given items (one row per item, with a header row). */
export function inventoryCsv(
  items: InventoryItem[],
  categoryById: Map<string, InventoryCategory>,
  locationById: Map<string, InventoryLocation>,
  currency = 'INR',
): string {
  const header = [
    'Name',
    'Category',
    'Location',
    'Quantity',
    'Unit',
    'Minimum stock',
    'Stock status',
    `Purchase price (${currency})`,
    'Purchase date',
    'Expiry date',
    'Barcode',
    'Notes',
    'Archived',
  ];
  const rows = items.map((item) => [
    item.name,
    categoryById.get(item.categoryId)?.name,
    locationById.get(item.locationId)?.name,
    item.quantity,
    item.unit,
    item.minQuantity,
    STOCK_LABELS[stockStatus(item)],
    item.purchasePriceMinor === undefined ? '' : minorToInput(item.purchasePriceMinor, currency),
    item.purchaseDate,
    item.expiryDate,
    item.barcode,
    item.notes,
    item.archived ? 'Yes' : 'No',
  ]);
  return toCsv([header, ...rows]);
}

export function exportInventoryCsv(
  items: InventoryItem[],
  categoryById: Map<string, InventoryCategory>,
  locationById: Map<string, InventoryLocation>,
  today: string,
  currency?: string,
): void {
  downloadTextFile(`homehub-inventory-${today}.csv`, inventoryCsv(items, categoryById, locationById, currency));
}
