import { describe, expect, it } from 'vitest';
import { describeRecurrence, iterateOccurrences, nextOccurrence, occurrencesBetween } from '@/lib/recurrence';
import type { RecurrenceRule } from '@/types/models';

function take(rule: RecurrenceRule, anchor: string, count: number): string[] {
  const result: string[] = [];
  for (const date of iterateOccurrences(rule, anchor)) {
    result.push(date);
    if (result.length === count) break;
  }
  return result;
}

describe('iterateOccurrences', () => {
  it('generates daily occurrences with an interval', () => {
    expect(take({ frequency: 'daily', interval: 2 }, '2026-10-01', 3)).toEqual(['2026-10-01', '2026-10-03', '2026-10-05']);
  });

  it('generates weekly occurrences on chosen weekdays, never before the anchor', () => {
    // 2026-10-29 is a Thursday; Monday of that week (26th) is before the anchor and skipped.
    expect(take({ frequency: 'weekly', interval: 1, byWeekday: [4, 1] }, '2026-10-29', 4)).toEqual([
      '2026-10-29',
      '2026-11-02',
      '2026-11-05',
      '2026-11-09',
    ]);
  });

  it('supports fortnightly schedules', () => {
    expect(take({ frequency: 'weekly', interval: 2 }, '2026-10-01', 3)).toEqual(['2026-10-01', '2026-10-15', '2026-10-29']);
  });

  it('keeps monthly series anchored on the 31st (clamping short months)', () => {
    expect(take({ frequency: 'monthly', interval: 1 }, '2026-01-31', 4)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('generates quarterly and yearly occurrences', () => {
    expect(take({ frequency: 'quarterly', interval: 1 }, '2026-01-15', 3)).toEqual(['2026-01-15', '2026-04-15', '2026-07-15']);
    expect(take({ frequency: 'yearly', interval: 1 }, '2024-02-29', 3)).toEqual(['2024-02-29', '2025-02-28', '2026-02-28']);
  });

  it('stops at the until date (inclusive)', () => {
    expect([...iterateOccurrences({ frequency: 'daily', interval: 1, until: '2026-10-03' }, '2026-10-01')]).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
  });

  it('treats an invalid interval as 1', () => {
    expect(take({ frequency: 'daily', interval: 0 }, '2026-10-01', 2)).toEqual(['2026-10-01', '2026-10-02']);
  });
});

describe('nextOccurrence', () => {
  it('returns the first occurrence strictly after the given date', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', interval: 1 };
    expect(nextOccurrence(rule, '2026-01-31', '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrence(rule, '2026-01-31', '2026-02-28')).toBe('2026-03-31');
  });

  it('returns null once the series has ended', () => {
    expect(nextOccurrence({ frequency: 'weekly', interval: 1, until: '2026-10-10' }, '2026-10-01', '2026-10-08')).toBeNull();
  });
});

describe('occurrencesBetween', () => {
  it('returns occurrences inside an inclusive window', () => {
    expect(occurrencesBetween({ frequency: 'weekly', interval: 1 }, '2026-09-03', '2026-10-01', '2026-10-31')).toEqual([
      '2026-10-01',
      '2026-10-08',
      '2026-10-15',
      '2026-10-22',
      '2026-10-29',
    ]);
  });

  it('respects until within the window', () => {
    expect(occurrencesBetween({ frequency: 'daily', interval: 3, until: '2026-10-08' }, '2026-10-01', '2026-10-03', '2026-10-31')).toEqual([
      '2026-10-04',
      '2026-10-07',
    ]);
  });
});

describe('describeRecurrence', () => {
  it('describes rules in plain language', () => {
    expect(describeRecurrence(undefined)).toBe('Does not repeat');
    expect(describeRecurrence({ frequency: 'weekly', interval: 1, byWeekday: [4, 1] })).toBe('Weekly on Mon, Thu');
    expect(describeRecurrence({ frequency: 'monthly', interval: 2 })).toBe('Every 2 months');
    expect(describeRecurrence({ frequency: 'daily', interval: 1, until: '2026-12-31' })).toBe('Daily until 2026-12-31');
  });
});
