import type { ExpenseSplit, Minor, SplitMethod, SplitShare } from '@/types/models';
import { allocateByWeights, allocateEvenly, parseMoneyInput } from '@/lib/money';

/**
 * Allowed difference (in minor units) between the sum of split shares and the expense amount.
 * Zero: equal and percentage splits are allocated with the largest-remainder method so they
 * always sum exactly, and custom amounts must add up exactly.
 */
export const SPLIT_TOLERANCE_MINOR = 0;

/** 100.00% expressed in basis points. */
export const FULL_PERCENT_BP = 10_000;

export const SPLIT_METHOD_LABELS: Record<SplitMethod, string> = {
  equal: 'Equally',
  percentage: 'By percentage',
  amount: 'Custom amounts',
};

export function equalSplit(totalMinor: Minor, userIds: string[]): SplitShare[] {
  const shares = allocateEvenly(totalMinor, userIds.length);
  return userIds.map((userId, index) => ({ userId, shareMinor: shares[index] ?? 0 }));
}

/** Allocates by basis-point weights; the shares always sum exactly to `totalMinor`. */
export function percentageSplit(totalMinor: Minor, entries: { userId: string; percentBp: number }[]): SplitShare[] {
  const shares = allocateByWeights(
    totalMinor,
    entries.map((entry) => entry.percentBp),
  );
  return entries.map((entry, index) => ({ userId: entry.userId, shareMinor: shares[index] ?? 0, percentBp: entry.percentBp }));
}

/** Parses "33.33" into 3333 basis points. Allows up to two decimals; returns null otherwise. */
export function parsePercentToBp(input: string): number | null {
  const match = /^(\d{1,3})(?:\.(\d{0,2}))?$/.exec(input.trim());
  if (!match) return null;
  const value = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return value <= FULL_PERCENT_BP ? value : null;
}

export function formatBp(bp: number): string {
  return `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 2)}%`;
}

export interface SplitValidation {
  ok: boolean;
  /** Amount still to allocate (negative when over-allocated). */
  remainingMinor: Minor;
  message?: string;
}

/** Checks that a split covers the expense exactly and every share is non-negative. */
export function validateSplit(totalMinor: Minor, split: ExpenseSplit): SplitValidation {
  if (split.shares.length === 0) return { ok: false, remainingMinor: totalMinor, message: 'Choose at least one person to split with' };
  if (new Set(split.shares.map((share) => share.userId)).size !== split.shares.length) {
    return { ok: false, remainingMinor: 0, message: 'Each person can only appear once in a split' };
  }
  if (split.shares.some((share) => !Number.isInteger(share.shareMinor) || share.shareMinor < 0)) {
    return { ok: false, remainingMinor: 0, message: 'Shares must be zero or more' };
  }
  if (split.method === 'percentage') {
    const totalBp = split.shares.reduce((sum, share) => sum + (share.percentBp ?? 0), 0);
    if (totalBp !== FULL_PERCENT_BP) {
      return {
        ok: false,
        remainingMinor: totalMinor - split.shares.reduce((sum, share) => sum + share.shareMinor, 0),
        message: `Percentages add up to ${formatBp(totalBp)} — they must total 100%`,
      };
    }
  }
  const allocated = split.shares.reduce((sum, share) => sum + share.shareMinor, 0);
  const remainingMinor = totalMinor - allocated;
  if (Math.abs(remainingMinor) > SPLIT_TOLERANCE_MINOR) {
    return { ok: false, remainingMinor, message: 'The shares don’t add up to the expense amount' };
  }
  return { ok: true, remainingMinor };
}

/* ------------------------------------------------------------------ */
/* Form draft                                                          */
/* ------------------------------------------------------------------ */

/** Split editor state as kept by forms (strings exactly as typed). */
export interface SplitDraft {
  enabled: boolean;
  method: SplitMethod;
  userIds: string[];
  percents: Record<string, string>;
  amounts: Record<string, string>;
}

export function emptySplitDraft(userIds: string[] = []): SplitDraft {
  return { enabled: false, method: 'equal', userIds, percents: {}, amounts: {} };
}

export function splitToDraft(split: ExpenseSplit | undefined, fallbackUserIds: string[], formatAmount: (minor: Minor) => string): SplitDraft {
  if (!split) return emptySplitDraft(fallbackUserIds);
  return {
    enabled: true,
    method: split.method,
    userIds: split.shares.map((share) => share.userId),
    percents: Object.fromEntries(split.shares.map((share) => [share.userId, share.percentBp !== undefined ? String(share.percentBp / 100) : ''])),
    amounts: Object.fromEntries(split.shares.map((share) => [share.userId, formatAmount(share.shareMinor)])),
  };
}

export interface DraftResult {
  split?: ExpenseSplit;
  error?: string;
  remainingMinor: Minor;
}

/** Converts the editor draft into a validated split for `totalMinor`. */
export function draftToSplit(draft: SplitDraft, totalMinor: Minor | null, currency: string): DraftResult {
  if (!draft.enabled) return { remainingMinor: 0 };
  if (totalMinor === null || totalMinor <= 0) return { error: 'Enter the amount before splitting', remainingMinor: 0 };
  if (draft.userIds.length === 0) return { error: 'Choose at least one person to split with', remainingMinor: totalMinor };

  let split: ExpenseSplit;
  if (draft.method === 'equal') {
    split = { method: 'equal', shares: equalSplit(totalMinor, draft.userIds) };
  } else if (draft.method === 'percentage') {
    const entries: { userId: string; percentBp: number }[] = [];
    for (const userId of draft.userIds) {
      const bp = parsePercentToBp(draft.percents[userId] ?? '');
      if (bp === null) return { error: 'Enter a percentage from 0 to 100 (up to 2 decimals) for everyone', remainingMinor: totalMinor };
      entries.push({ userId, percentBp: bp });
    }
    const totalBp = entries.reduce((sum, entry) => sum + entry.percentBp, 0);
    if (totalBp !== FULL_PERCENT_BP) {
      return { error: `Percentages add up to ${formatBp(totalBp)} — they must total 100%`, remainingMinor: totalMinor - Math.round((totalMinor * totalBp) / FULL_PERCENT_BP) };
    }
    split = { method: 'percentage', shares: percentageSplit(totalMinor, entries) };
  } else {
    const shares: SplitShare[] = [];
    for (const userId of draft.userIds) {
      const raw = draft.amounts[userId] ?? '';
      const minor = raw.trim() === '' ? 0 : parseMoneyInput(raw, currency);
      if (minor === null) return { error: 'Enter a valid amount for everyone', remainingMinor: totalMinor };
      shares.push({ userId, shareMinor: minor });
    }
    split = { method: 'amount', shares };
  }
  const validation = validateSplit(totalMinor, split);
  return validation.ok ? { split, remainingMinor: 0 } : { error: validation.message, remainingMinor: validation.remainingMinor };
}

/** The share of an expense owed by `userId` (0 when the expense is not split). */
export function shareOf(split: ExpenseSplit | undefined, userId: string): Minor {
  return split?.shares.find((share) => share.userId === userId)?.shareMinor ?? 0;
}
