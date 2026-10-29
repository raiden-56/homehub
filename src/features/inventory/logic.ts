import type { InventoryItem, InventoryMovement, ISODate } from '@/types/models';
import { addDaysISO, daysBetween, isoDateInZone } from '@/lib/dates';

export type StockStatus = 'out' | 'low' | 'ok';
export type ExpiryStatus = 'expired' | 'soon' | 'ok' | 'none';

export const STOCK_LABELS: Record<StockStatus, string> = { out: 'Out of stock', low: 'Low stock', ok: 'In stock' };
export const EXPIRY_LABELS: Record<ExpiryStatus, string> = {
  expired: 'Expired',
  soon: 'Expiring soon',
  ok: 'Fresh',
  none: 'No expiry',
};

export const DEFAULT_EXPIRY_WARNING_DAYS = 5;

/** Out of stock at zero; low when the quantity has fallen below the minimum threshold. */
export function stockStatus(item: Pick<InventoryItem, 'quantity' | 'minQuantity'>): StockStatus {
  if (item.quantity <= 0) return 'out';
  if (item.minQuantity > 0 && item.quantity < item.minQuantity) return 'low';
  return 'ok';
}

/** Items without an expiry date are never flagged. */
export function expiryStatus(
  item: Pick<InventoryItem, 'expiryDate'>,
  today: ISODate,
  warningDays = DEFAULT_EXPIRY_WARNING_DAYS,
): ExpiryStatus {
  if (!item.expiryDate) return 'none';
  const days = daysBetween(today, item.expiryDate);
  if (days < 0) return 'expired';
  if (days <= warningDays) return 'soon';
  return 'ok';
}

/** Rounds quantities to avoid floating-point noise such as 0.30000000000000004. */
export function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Formats a quantity without trailing zeros: 1.5, 2, 0.25. */
export function formatQuantity(value: number): string {
  return String(roundQuantity(value));
}

/* ------------------------------------------------------------------ */
/* Consumption estimate                                                */
/* ------------------------------------------------------------------ */

export const ESTIMATE_WINDOW_DAYS = 60;
export const ESTIMATE_MIN_EVENTS = 3;
export const ESTIMATE_MIN_SPAN_DAYS = 7;

export type ConsumptionEstimate =
  | { kind: 'estimate'; dailyRate: number; daysLeft: number; runOutDate: ISODate; events: number }
  | { kind: 'out' }
  | { kind: 'insufficient'; events: number };

/**
 * Estimates when an item will run out from `consume` movements in the last 60 days. Requires at
 * least three uses spanning a week; otherwise reports that more history is needed. The result
 * is a suggestion only.
 */
export function estimateConsumption(
  item: Pick<InventoryItem, 'id' | 'quantity'>,
  movements: InventoryMovement[],
  today: ISODate,
  timeZone: string,
): ConsumptionEstimate {
  const windowStart = addDaysISO(today, -ESTIMATE_WINDOW_DAYS);
  const uses = movements
    .filter((movement) => movement.itemId === item.id && movement.type === 'consume' && movement.delta < 0)
    .map((movement) => ({ date: isoDateInZone(movement.occurredAt, timeZone), amount: -movement.delta }))
    .filter((use) => use.date >= windowStart && use.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (item.quantity <= 0) return { kind: 'out' };
  if (uses.length < ESTIMATE_MIN_EVENTS) return { kind: 'insufficient', events: uses.length };
  const first = uses[0]!.date;
  const span = daysBetween(first, today);
  if (span < ESTIMATE_MIN_SPAN_DAYS) return { kind: 'insufficient', events: uses.length };
  const total = uses.reduce((sum, use) => sum + use.amount, 0);
  const dailyRate = total / span;
  if (dailyRate <= 0) return { kind: 'insufficient', events: uses.length };
  const daysLeft = item.quantity / dailyRate;
  return {
    kind: 'estimate',
    dailyRate,
    daysLeft,
    runOutDate: addDaysISO(today, Math.floor(daysLeft)),
    events: uses.length,
  };
}

/* ------------------------------------------------------------------ */
/* Filtering & sorting                                                 */
/* ------------------------------------------------------------------ */

export interface InventoryFilterState {
  q: string;
  stock?: 'low' | 'out';
  expiry?: 'soon' | 'expired';
  location?: string;
  category?: string;
  archived: boolean;
}

export type InventorySort = 'name' | 'quantity' | 'purchaseDate' | 'expiryDate';

export const SORT_LABELS: Record<InventorySort, string> = {
  name: 'Name',
  quantity: 'Quantity',
  purchaseDate: 'Purchase date',
  expiryDate: 'Expiry date',
};

/** `stock=low` includes out-of-stock items (both need restocking); `stock=out` is zero only. */
export function matchesFilters(
  item: InventoryItem,
  filters: InventoryFilterState,
  today: ISODate,
  warningDays: number,
  categoryName?: string,
  locationName?: string,
): boolean {
  if (item.archived !== filters.archived) return false;
  if (filters.category && item.categoryId !== filters.category) return false;
  if (filters.location && item.locationId !== filters.location) return false;
  if (filters.stock) {
    const status = stockStatus(item);
    if (filters.stock === 'out' ? status !== 'out' : status === 'ok') return false;
  }
  if (filters.expiry && expiryStatus(item, today, warningDays) !== filters.expiry) return false;
  const query = filters.q.trim().toLocaleLowerCase();
  if (query) {
    const haystack = [item.name, item.barcode, item.notes, categoryName, locationName]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();
    if (!haystack.includes(query)) return false;
  }
  return true;
}

export function sortItems(items: InventoryItem[], sort: InventorySort): InventoryItem[] {
  const byName = (a: InventoryItem, b: InventoryItem) => a.name.localeCompare(b.name);
  // Items without a date sort last regardless of the field.
  const byOptionalDate = (key: 'purchaseDate' | 'expiryDate', descending: boolean) => (a: InventoryItem, b: InventoryItem) => {
    const left = a[key];
    const right = b[key];
    if (left && right) return (descending ? right.localeCompare(left) : left.localeCompare(right)) || byName(a, b);
    if (left) return -1;
    if (right) return 1;
    return byName(a, b);
  };
  const sorted = [...items];
  switch (sort) {
    case 'name':
      return sorted.sort(byName);
    case 'quantity':
      return sorted.sort((a, b) => a.quantity - b.quantity || byName(a, b));
    case 'purchaseDate':
      return sorted.sort(byOptionalDate('purchaseDate', true));
    case 'expiryDate':
      return sorted.sort(byOptionalDate('expiryDate', false));
  }
}

export const MOVEMENT_LABELS: Record<InventoryMovement['type'], string> = {
  initial: 'Opening stock',
  restock: 'Restocked',
  consume: 'Used',
  adjust: 'Adjusted',
  purchase: 'Purchased',
};
