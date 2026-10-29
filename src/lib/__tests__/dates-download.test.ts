import { describe, expect, it } from 'vitest';
import { addDaysISO, daysBetween, greetingFor, isISODate, relativeDay, todayIn } from '@/lib/dates';
import { csvCell, toCsv } from '@/lib/download';

describe('dates', () => {
  it('computes today in the household time zone, not the device zone', () => {
    const instant = new Date('2026-10-29T20:30:00Z');
    expect(todayIn('Asia/Kolkata', instant)).toBe('2026-10-30');
    expect(todayIn('America/New_York', instant)).toBe('2026-10-29');
  });

  it('does calendar arithmetic on date-only values', () => {
    expect(addDaysISO('2026-02-27', 2)).toBe('2026-03-01');
    expect(daysBetween('2026-10-29', '2026-11-01')).toBe(3);
    expect(daysBetween('2026-11-01', '2026-10-29')).toBe(-3);
  });

  it('labels days relative to today', () => {
    expect(relativeDay('2026-10-29', '2026-10-29')).toBe('Today');
    expect(relativeDay('2026-10-30', '2026-10-29')).toBe('Tomorrow');
    expect(relativeDay('2026-10-27', '2026-10-29')).toBe('2 days ago');
    expect(relativeDay('2026-11-02', '2026-10-29')).toBe('in 4 days');
  });

  it('validates ISO dates', () => {
    expect(isISODate('2026-10-29')).toBe(true);
    expect(isISODate('2026-13-01')).toBe(false);
    expect(isISODate('29/10/2026')).toBe(false);
  });

  it('greets by time of day', () => {
    expect(greetingFor(8)).toBe('Good morning');
    expect(greetingFor(14)).toBe('Good afternoon');
    expect(greetingFor(20)).toBe('Good evening');
  });
});

describe('csv', () => {
  it('escapes quotes, commas and newlines', () => {
    expect(csvCell('Rice, basmati')).toBe('"Rice, basmati"');
    expect(csvCell('5" pan')).toBe('"5"" pan"');
    expect(csvCell(undefined)).toBe('');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell(-5)).toBe('-5');
  });

  it('joins rows with CRLF', () => {
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\r\n1,x');
  });
});
