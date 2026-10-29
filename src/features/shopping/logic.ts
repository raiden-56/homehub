import type { ChangeSet } from '@/data/collections';
import type {
  Expense,
  ExpenseSplit,
  InventoryItem,
  InventoryMovement,
  ISODate,
  Minor,
  ShoppingItem,
  ShoppingList,
} from '@/types/models';
import { UNITS } from '@/lib/constants';
import { allocateEvenly } from '@/lib/money';
import { newId } from '@/lib/ids';
import { roundQuantity } from '@/features/inventory/logic';

/* ------------------------------------------------------------------ */
/* Quick-add parsing                                                   */
/* ------------------------------------------------------------------ */

const UNIT_ALIASES: Record<string, string> = {
  pc: 'pcs',
  pcs: 'pcs',
  piece: 'pcs',
  pieces: 'pcs',
  kg: 'kg',
  kgs: 'kg',
  g: 'g',
  gm: 'g',
  gms: 'g',
  gram: 'g',
  grams: 'g',
  l: 'L',
  ltr: 'L',
  litre: 'L',
  litres: 'L',
  liter: 'L',
  liters: 'L',
  ml: 'ml',
  pack: 'pack',
  packs: 'pack',
  packet: 'pack',
  packets: 'pack',
  bottle: 'bottle',
  bottles: 'bottle',
  box: 'box',
  boxes: 'box',
  dozen: 'dozen',
  dozens: 'dozen',
  roll: 'roll',
  rolls: 'roll',
  can: 'can',
  cans: 'can',
  bag: 'bag',
  bags: 'bag',
};

export interface ParsedEntry {
  name: string;
  quantity: number;
  unit: string;
}

function capitalise(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

export function normaliseUnit(value: string): string | undefined {
  const lower = value.toLowerCase();
  return UNIT_ALIASES[lower] ?? UNITS.find((unit) => unit.toLowerCase() === lower);
}

/**
 * Parses quick-add text such as "2 kg rice", "1.5L milk", "6 eggs" or "bread". Unknown words
 * after the number are treated as part of the name ("2 ripe mangoes" → 2 pcs "Ripe mangoes").
 */
export function parseQuickAdd(input: string): ParsedEntry | null {
  const text = input.trim().replace(/\s+/g, ' ');
  if (!text) return null;
  const match = /^(\d+(?:[.,]\d+)?)(\s*)([a-zA-Z]+)?(?:\s+(.+))?$/.exec(text);
  if (match) {
    const quantity = Number(match[1]!.replace(',', '.'));
    const spaced = match[2] !== '';
    const word = match[3];
    const rest = match[4];
    const unit = word ? normaliseUnit(word) : undefined;
    if (quantity > 0) {
      if (unit && rest) return { quantity: roundQuantity(quantity), unit, name: capitalise(rest) };
      // "7up" or "2 kg" alone are names, not quantities.
      if (word && !unit && spaced) {
        return { quantity: roundQuantity(quantity), unit: 'pcs', name: capitalise([word, rest].filter(Boolean).join(' ')) };
      }
    }
  }
  return { quantity: 1, unit: 'pcs', name: capitalise(text) };
}

/** Parses "one item per line" text, ignoring blank lines. */
export function parseLines(input: string): ParsedEntry[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•]\s*/, ''))
    .map(parseQuickAdd)
    .filter((entry): entry is ParsedEntry => entry !== null && entry.name.length <= 80);
}

/* ------------------------------------------------------------------ */
/* Lists                                                               */
/* ------------------------------------------------------------------ */

export function normaliseName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

/** Items still to buy (not purchased and not cleared). */
export function isPending(item: ShoppingItem): boolean {
  return !item.purchased && !item.clearedAt;
}

/** An unpurchased, uncleared entry in `listId` for the same inventory item or same name. */
export function findDuplicate(
  items: ShoppingItem[],
  listId: string,
  candidate: { name: string; inventoryItemId?: string },
): ShoppingItem | undefined {
  const name = normaliseName(candidate.name);
  return items.find(
    (item) =>
      item.listId === listId &&
      isPending(item) &&
      ((candidate.inventoryItemId && item.inventoryItemId === candidate.inventoryItemId) || normaliseName(item.name) === name),
  );
}

/** Most recently active non-archived list. */
export function defaultList(lists: ShoppingList[]): ShoppingList | undefined {
  return lists
    .filter((list) => !list.archived)
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))[0];
}

export function nextSortOrder(items: ShoppingItem[], listId: string): number {
  return items.filter((item) => item.listId === listId).reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1;
}

/** Names ranked by how often the household has added/bought them, then inventory names. */
export function quickAddSuggestions(shoppingItems: ShoppingItem[], inventoryNames: string[]): string[] {
  const counts = new Map<string, { name: string; count: number }>();
  const bump = (name: string, weight: number) => {
    const key = normaliseName(name);
    if (!key) return;
    const entry = counts.get(key) ?? { name: name.trim(), count: 0 };
    entry.count += weight;
    counts.set(key, entry);
  };
  for (const item of shoppingItems) bump(item.name, item.purchased ? 2 : 1);
  for (const name of inventoryNames) bump(name, 0.5);
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).map((entry) => entry.name);
}

export interface ListSummary {
  remaining: number;
  purchased: number;
  estimatedTotalMinor: Minor;
  hasEstimate: boolean;
}

/** Remaining count and estimated cost of what's still to buy. */
export function summariseList(items: ShoppingItem[], listId: string): ListSummary {
  let remaining = 0;
  let purchased = 0;
  let estimatedTotalMinor = 0;
  let hasEstimate = false;
  for (const item of items) {
    if (item.listId !== listId || item.clearedAt) continue;
    if (item.purchased) {
      purchased += 1;
      continue;
    }
    remaining += 1;
    if (item.estimatedPriceMinor !== undefined) {
      estimatedTotalMinor += item.estimatedPriceMinor;
      hasEstimate = true;
    }
  }
  return { remaining, purchased, estimatedTotalMinor, hasEstimate };
}

/** Expense category for a purchase, based on the inventory category name. */
export function defaultExpenseCategory(inventoryCategoryName: string | undefined): string {
  return inventoryCategoryName && /clean|paper|toilet/i.test(inventoryCategoryName) ? 'Household supplies' : 'Groceries';
}

/* ------------------------------------------------------------------ */
/* Receiving a purchase                                                */
/* ------------------------------------------------------------------ */

export type ReceiveInventoryTarget =
  | { mode: 'none' }
  | { mode: 'existing'; item: InventoryItem }
  | { mode: 'new'; name: string; categoryId: string; locationId: string; unit: string; minQuantity: number };

export interface ReceivePurchaseInput {
  shoppingItem: ShoppingItem;
  list: ShoppingList;
  actorId: string;
  now: string;
  today: ISODate;
  actualPriceMinor?: Minor;
  quantity: number;
  inventory: ReceiveInventoryTarget;
  expense?: { category: string; payerId: string; splitWith?: string[] };
}

export interface ReceivePurchaseResult {
  changes: ChangeSet;
  /** Human-readable list of every change, shown before confirming. */
  summary: string[];
  idempotencyKey: string;
}

export function receiveIdempotencyKey(shoppingItemId: string): string {
  return `receive:${shoppingItemId}`;
}

/**
 * Builds the single atomic change set that records a purchase: the shopping item, the inventory
 * update + movement, and the expense. Throws if the item was already received.
 */
export function buildReceivePurchase(input: ReceivePurchaseInput): ReceivePurchaseResult {
  const { shoppingItem, list, actorId, now, today, actualPriceMinor, quantity, inventory, expense } = input;
  if (shoppingItem.receivedAt) throw new Error('This purchase was already recorded.');
  if (!(quantity > 0)) throw new Error('Quantity received must be more than zero.');
  if (expense && !(actualPriceMinor && actualPriceMinor > 0)) throw new Error('Enter the price paid to record an expense.');

  const summary: string[] = [];
  const put: ChangeSet['put'] = {};
  const received = roundQuantity(quantity);

  let inventoryItemId = shoppingItem.inventoryItemId;
  let movementId: string | undefined;
  if (inventory.mode === 'existing') {
    const current = inventory.item;
    const quantityAfter = roundQuantity(current.quantity + received);
    const movement: InventoryMovement = {
      id: newId(),
      householdId: current.householdId,
      itemId: current.id,
      type: 'purchase',
      delta: received,
      quantityAfter,
      note: `Bought from ${list.name}`,
      actorId,
      occurredAt: now,
      sourceShoppingItemId: shoppingItem.id,
      createdAt: now,
      updatedAt: now,
    };
    put.inventoryItems = [
      {
        ...current,
        quantity: quantityAfter,
        archived: false,
        purchaseDate: today,
        purchasePriceMinor: actualPriceMinor ?? current.purchasePriceMinor,
        updatedAt: now,
      },
    ];
    put.inventoryMovements = [movement];
    inventoryItemId = current.id;
    movementId = movement.id;
    summary.push(`Inventory: ${current.name} ${current.quantity} → ${quantityAfter} ${current.unit}`);
  } else if (inventory.mode === 'new') {
    const id = newId();
    const item: InventoryItem = {
      id,
      householdId: shoppingItem.householdId,
      name: inventory.name.trim(),
      categoryId: inventory.categoryId,
      locationId: inventory.locationId,
      quantity: received,
      unit: inventory.unit,
      minQuantity: inventory.minQuantity,
      purchasePriceMinor: actualPriceMinor,
      purchaseDate: today,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    const movement: InventoryMovement = {
      id: newId(),
      householdId: item.householdId,
      itemId: id,
      type: 'purchase',
      delta: received,
      quantityAfter: received,
      note: `Bought from ${list.name}`,
      actorId,
      occurredAt: now,
      sourceShoppingItemId: shoppingItem.id,
      createdAt: now,
      updatedAt: now,
    };
    put.inventoryItems = [item];
    put.inventoryMovements = [movement];
    inventoryItemId = id;
    movementId = movement.id;
    summary.push(`Inventory: new item “${item.name}” with ${received} ${item.unit}`);
  } else {
    summary.push('Inventory: not changed');
  }

  let expenseId: string | undefined;
  if (expense && actualPriceMinor) {
    const participants = expense.splitWith && expense.splitWith.length > 1 ? expense.splitWith : undefined;
    let split: ExpenseSplit | undefined;
    if (participants) {
      const shares = allocateEvenly(actualPriceMinor, participants.length);
      split = { method: 'equal', shares: participants.map((userId, index) => ({ userId, shareMinor: shares[index]! })) };
    }
    const record: Expense = {
      id: newId(),
      householdId: shoppingItem.householdId,
      description: shoppingItem.name,
      amountMinor: actualPriceMinor,
      date: today,
      category: expense.category,
      payerId: expense.payerId,
      source: 'shopping',
      sourceId: shoppingItem.id,
      split,
      createdAt: now,
      updatedAt: now,
    };
    put.expenses = [record];
    expenseId = record.id;
    summary.push(
      `Expense: ${expense.category}${participants ? `, split equally between ${participants.length} people` : ''}`,
    );
  } else {
    summary.push('Expense: not recorded');
  }

  put.shoppingItems = [
    {
      ...shoppingItem,
      purchased: true,
      purchasedAt: shoppingItem.purchasedAt ?? now,
      purchasedBy: shoppingItem.purchasedBy ?? actorId,
      actualPriceMinor: actualPriceMinor ?? shoppingItem.actualPriceMinor,
      inventoryItemId,
      receivedAt: now,
      receivedMovementId: movementId,
      expenseId,
      updatedAt: now,
    },
  ];
  put.shoppingLists = [{ ...list, lastActivityAt: now, updatedAt: now }];

  return { changes: { put }, summary, idempotencyKey: receiveIdempotencyKey(shoppingItem.id) };
}
