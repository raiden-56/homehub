import { describe, expect, it } from 'vitest';
import { allocateByWeights, allocateEvenly, formatMoney, minorToInput, minorUnitDigits, parseMoneyInput } from '@/lib/money';

describe('formatMoney', () => {
  it('uses Indian digit grouping for rupees', () => {
    expect(formatMoney(12345678, 'INR')).toBe('₹1,23,456.78');
  });
  it('uses zero decimals for yen', () => {
    expect(minorUnitDigits('JPY')).toBe(0);
    expect(formatMoney(1500, 'JPY')).toMatch(/1,500/);
    expect(formatMoney(1500, 'JPY')).not.toMatch(/\./);
  });
  it('defaults to INR', () => {
    expect(formatMoney(100)).toBe('₹1.00');
  });
});

describe('parseMoneyInput', () => {
  it('parses amounts without floating-point error', () => {
    expect(parseMoneyInput('1,250.50')).toBe(125050);
    expect(parseMoneyInput('0.1')).toBe(10);
    expect(parseMoneyInput('19.99')).toBe(1999);
    expect(parseMoneyInput(' 42 ')).toBe(4200);
  });
  it('rejects invalid input', () => {
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput('1.234')).toBeNull();
    expect(parseMoneyInput('-5')).toBeNull();
    expect(parseMoneyInput('abc')).toBeNull();
    expect(parseMoneyInput('1.5', 'JPY')).toBeNull();
  });
  it('respects zero-decimal currencies', () => {
    expect(parseMoneyInput('1500', 'JPY')).toBe(1500);
  });
});

describe('minorToInput', () => {
  it('round-trips with parseMoneyInput', () => {
    expect(minorToInput(125050)).toBe('1250.50');
    expect(minorToInput(5)).toBe('0.05');
    expect(minorToInput(undefined)).toBe('');
    expect(minorToInput(1500, 'JPY')).toBe('1500');
    expect(parseMoneyInput(minorToInput(98765))).toBe(98765);
  });
});

describe('allocation', () => {
  it('allocateEvenly sums exactly', () => {
    expect(allocateEvenly(100, 3)).toEqual([34, 33, 33]);
    expect(allocateEvenly(5, 0)).toEqual([]);
  });
  it('allocateByWeights uses the largest remainder and sums exactly', () => {
    const parts = allocateByWeights(100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(allocateByWeights(1000, [7500, 2500])).toEqual([750, 250]);
    expect(allocateByWeights(100, [0, 0])).toEqual([0, 0]);
  });
});
