import type { Expense, Minor, Settlement } from '@/types/models';

/** Net position per user: positive means the household owes them, negative means they owe. */
export type Balances = Record<string, Minor>;

export interface Transfer {
  fromUserId: string;
  toUserId: string;
  amountMinor: Minor;
}

/**
 * Computes net balances from split expenses and recorded settlements. For each split expense
 * the payer is credited with the full amount and every participant (including the payer) is
 * debited their share. A settlement from A to B moves A towards zero and B down accordingly.
 * Expenses without a split are personal and do not affect balances.
 */
export function computeBalances(expenses: Expense[], settlements: Settlement[], memberIds: string[] = []): Balances {
  const balances: Balances = {};
  for (const id of memberIds) balances[id] = 0;
  const add = (userId: string, delta: Minor) => {
    balances[userId] = (balances[userId] ?? 0) + delta;
  };
  for (const expense of expenses) {
    if (!expense.split || expense.split.shares.length === 0) continue;
    add(expense.payerId, expense.amountMinor);
    for (const share of expense.split.shares) add(share.userId, -share.shareMinor);
  }
  for (const settlement of settlements) {
    add(settlement.fromUserId, settlement.amountMinor);
    add(settlement.toUserId, -settlement.amountMinor);
  }
  return balances;
}

/**
 * Suggests transfers that settle every balance, greedily matching the largest debtor with the
 * largest creditor. Each step settles at least one person, so there are at most n − 1
 * transfers, and the amounts owed by and to each person are unchanged.
 */
export function minimizeTransfers(balances: Balances): Transfer[] {
  const creditors = Object.entries(balances)
    .filter(([, amount]) => amount > 0)
    .map(([userId, amount]) => ({ userId, amount }));
  const debtors = Object.entries(balances)
    .filter(([, amount]) => amount < 0)
    .map(([userId, amount]) => ({ userId, amount: -amount }));
  const transfers: Transfer[] = [];
  const byLargest = (a: { amount: number; userId: string }, b: { amount: number; userId: string }) =>
    b.amount - a.amount || a.userId.localeCompare(b.userId);

  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort(byLargest);
    debtors.sort(byLargest);
    const creditor = creditors[0]!;
    const debtor = debtors[0]!;
    const amount = Math.min(creditor.amount, debtor.amount);
    transfers.push({ fromUserId: debtor.userId, toUserId: creditor.userId, amountMinor: amount });
    creditor.amount -= amount;
    debtor.amount -= amount;
    if (creditor.amount === 0) creditors.shift();
    if (debtor.amount === 0) debtors.shift();
  }
  return transfers;
}
