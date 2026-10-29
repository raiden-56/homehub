import { describe, expect, it } from 'vitest';
import {
  SPLIT_TOLERANCE_MINOR,
  draftToSplit,
  equalSplit,
  parsePercentToBp,
  percentageSplit,
  validateSplit,
  type SplitDraft,
} from '../logic/splits';

const draft = (overrides: Partial<SplitDraft>): SplitDraft => ({
  enabled: true,
  method: 'equal',
  userIds: ['a', 'b', 'c'],
  percents: {},
  amounts: {},
  ...overrides,
});

describe('equalSplit', () => {
  it('distributes the remainder one minor unit at a time', () => {
    const shares = equalSplit(1000, ['a', 'b', 'c']);
    expect(shares.map((share) => share.shareMinor)).toEqual([334, 333, 333]);
    expect(shares.reduce((sum, share) => sum + share.shareMinor, 0)).toBe(1000);
  });
});

describe('percentageSplit', () => {
  it('sums exactly to the total despite rounding', () => {
    const shares = percentageSplit(10001, [
      { userId: 'a', percentBp: 3333 },
      { userId: 'b', percentBp: 3333 },
      { userId: 'c', percentBp: 3334 },
    ]);
    expect(shares.reduce((sum, share) => sum + share.shareMinor, 0)).toBe(10001);
    expect(validateSplit(10001, { method: 'percentage', shares }).ok).toBe(true);
  });
});

describe('parsePercentToBp', () => {
  it('parses up to two decimals', () => {
    expect(parsePercentToBp('33.33')).toBe(3333);
    expect(parsePercentToBp('50')).toBe(5000);
    expect(parsePercentToBp('12.5')).toBe(1250);
  });
  it('rejects invalid values', () => {
    expect(parsePercentToBp('101')).toBeNull();
    expect(parsePercentToBp('1.234')).toBeNull();
    expect(parsePercentToBp('-5')).toBeNull();
    expect(parsePercentToBp('')).toBeNull();
  });
});

describe('validateSplit', () => {
  it('uses an exact (zero) tolerance', () => {
    expect(SPLIT_TOLERANCE_MINOR).toBe(0);
  });
  it('rejects custom amounts that do not add up', () => {
    const result = validateSplit(1000, {
      method: 'amount',
      shares: [
        { userId: 'a', shareMinor: 600 },
        { userId: 'b', shareMinor: 399 },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.remainingMinor).toBe(1);
  });
  it('rejects duplicate participants and negative shares', () => {
    expect(validateSplit(100, { method: 'amount', shares: [{ userId: 'a', shareMinor: 50 }, { userId: 'a', shareMinor: 50 }] }).ok).toBe(false);
    expect(validateSplit(100, { method: 'amount', shares: [{ userId: 'a', shareMinor: 150 }, { userId: 'b', shareMinor: -50 }] }).ok).toBe(false);
  });
  it('rejects percentages that do not total 100%', () => {
    const result = validateSplit(1000, {
      method: 'percentage',
      shares: [
        { userId: 'a', shareMinor: 500, percentBp: 5000 },
        { userId: 'b', shareMinor: 500, percentBp: 4000 },
      ],
    });
    expect(result.ok).toBe(false);
  });
});

describe('draftToSplit', () => {
  it('returns nothing when splitting is off', () => {
    expect(draftToSplit(draft({ enabled: false }), 1000, 'INR')).toEqual({ remainingMinor: 0 });
  });
  it('builds an equal split', () => {
    expect(draftToSplit(draft({}), 1000, 'INR').split?.shares.map((share) => share.shareMinor)).toEqual([334, 333, 333]);
  });
  it('requires an amount first', () => {
    expect(draftToSplit(draft({}), null, 'INR').error).toMatch(/amount/i);
  });
  it('validates custom amounts using exact money parsing', () => {
    const ok = draftToSplit(draft({ method: 'amount', userIds: ['a', 'b'], amounts: { a: '6.00', b: '4' } }), 1000, 'INR');
    expect(ok.split?.shares.map((share) => share.shareMinor)).toEqual([600, 400]);
    const short = draftToSplit(draft({ method: 'amount', userIds: ['a', 'b'], amounts: { a: '6.00', b: '3.99' } }), 1000, 'INR');
    expect(short.error).toBeDefined();
    expect(short.remainingMinor).toBe(1);
  });
  it('validates percentages', () => {
    const bad = draftToSplit(draft({ method: 'percentage', userIds: ['a', 'b'], percents: { a: '60', b: '30' } }), 1000, 'INR');
    expect(bad.error).toMatch(/90%/);
    const good = draftToSplit(draft({ method: 'percentage', userIds: ['a', 'b'], percents: { a: '60', b: '40' } }), 1000, 'INR');
    expect(good.split?.shares.map((share) => share.shareMinor)).toEqual([600, 400]);
  });
});
