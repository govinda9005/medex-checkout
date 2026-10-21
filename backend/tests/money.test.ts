import { describe, it, expect } from 'vitest';
import {
  parseMoney,
  roundMoney,
  formatMoney,
  formatMoneyWithCommas,
  multiplyMoney,
  addMoney,
  subtractMoney,
  percentOf,
  calculateVat,
  isZero,
  isPositive,
  isNegative,
  compareMoney,
  isEqual,
  isGreaterThan,
  isGreaterThanOrEqualTo,
  isLessThan,
  isLessThanOrEqualTo,
  minMoney,
  maxMoney
} from '../src/utils/money.js';

describe('Financial Money Utilities', () => {
  describe('Parsing and Validation', () => {
    it('parses valid integer and decimal strings', () => {
      expect(formatMoney(parseMoney('100'))).toBe('100.00');
      expect(formatMoney(parseMoney('1200.00'))).toBe('1200.00');
      expect(formatMoney(parseMoney('3450.50'))).toBe('3450.50');
      expect(formatMoney(parseMoney('0.10'))).toBe('0.10');
    });

    it('trims leading and trailing whitespace', () => {
      expect(formatMoney(parseMoney('  1200.00  '))).toBe('1200.00');
    });

    it('rejects malformed and non-numeric inputs', () => {
      expect(() => parseMoney('')).toThrow();
      expect(() => parseMoney('abc')).toThrow();
      expect(() => parseMoney('12.34.56')).toThrow();
      expect(() => parseMoney(NaN)).toThrow();
      expect(() => parseMoney(Infinity)).toThrow();
    });
  });

  describe('Round-Half-Up Precision (Anti-Floating-Point Drift)', () => {
    it('rounds 0.125 to 0.13 as explicitly required by assessment', () => {
      expect(formatMoney('0.125')).toBe('0.13');
    });

    it('rounds 0.124 down to 0.12', () => {
      expect(formatMoney('0.124')).toBe('0.12');
    });

    it('rounds 0.126 up to 0.13', () => {
      expect(formatMoney('0.126')).toBe('0.13');
    });

    it('correctly rounds 1.005 up to 1.01 (which standard JS floating point fails)', () => {
      // In JS: (1.005).toFixed(2) === "1.00" due to IEEE-754 inaccuracy
      expect((1.005).toFixed(2)).toBe('1.00'); // proving JS float failure
      expect(formatMoney('1.005')).toBe('1.01'); // proving our utility handles it correctly
    });

    it('rounds satang half boundaries accurately', () => {
      expect(formatMoney('0.005')).toBe('0.01');
      expect(formatMoney('0.004')).toBe('0.00');
    });

    it('avoids 0.1 + 0.2 floating point drift', () => {
      const sum = addMoney('0.1', '0.2');
      expect(formatMoney(sum)).toBe('0.30');
      expect(sum.toString()).toBe('0.3');
    });
  });

  describe('Basic Arithmetic', () => {
    it('multiplies price by quantity accurately', () => {
      expect(formatMoney(multiplyMoney('333.33', 3))).toBe('999.99');
      expect(formatMoney(multiplyMoney('99.99', 2))).toBe('199.98');
      expect(formatMoney(multiplyMoney('1200.00', 1))).toBe('1200.00');
      expect(formatMoney(multiplyMoney('0.10', 20))).toBe('2.00');
    });

    it('adds multiple monetary values without precision loss', () => {
      const subtotal = addMoney('1200.00', '999.99', '199.98');
      expect(formatMoney(subtotal)).toBe('2399.97');
    });

    it('subtracts discounts from subtotal', () => {
      const net = subtractMoney('2399.97', '560.00');
      expect(formatMoney(net)).toBe('1839.97');
    });
  });

  describe('Percentages and VAT from Assessment Examples', () => {
    it('calculates 10% on 4650.50 (Example 1)', () => {
      expect(formatMoney(percentOf('4650.50', 10))).toBe('465.05');
    });

    it('calculates 15% on 2399.97 (Example 2: 359.9955 -> 360.00)', () => {
      expect(formatMoney(percentOf('2399.97', 15))).toBe('360.00');
    });

    it('calculates 33.333% on 1200.00 (Coupon THIRD: 399.996 -> 400.00)', () => {
      expect(formatMoney(percentOf('1200.00', '33.333'))).toBe('400.00');
    });

    it('calculates 7% VAT for Example 1 (4350.50 * 0.07 = 304.535 -> 304.54)', () => {
      expect(formatMoney(calculateVat('4350.50'))).toBe('304.54');
    });

    it('calculates 7% VAT for Example 2 (1839.97 * 0.07 = 128.7979 -> 128.80)', () => {
      expect(formatMoney(calculateVat('1839.97'))).toBe('128.80');
    });

    it('calculates 7% VAT for Example 3 (1750.10 * 0.07 = 122.507 -> 122.51)', () => {
      expect(formatMoney(calculateVat('1750.10'))).toBe('122.51');
    });
  });

  describe('Formatting with Commas', () => {
    it('formats thousands separators with 2 decimals', () => {
      expect(formatMoneyWithCommas('1234.50')).toBe('1,234.50');
      expect(formatMoneyWithCommas('1234567.89')).toBe('1,234,567.89');
      expect(formatMoneyWithCommas('500.00')).toBe('500.00');
      expect(formatMoneyWithCommas('0.1')).toBe('0.10');
      expect(formatMoneyWithCommas('0')).toBe('0.00');
    });
  });

  describe('Comparisons and Utility Predicates', () => {
    it('evaluates isZero, isPositive, isNegative', () => {
      expect(isZero('0.00')).toBe(true);
      expect(isZero('0')).toBe(true);
      expect(isZero('0.01')).toBe(false);

      expect(isPositive('10.00')).toBe(true);
      expect(isPositive('0.00')).toBe(false);
      expect(isPositive('-1.00')).toBe(false);

      expect(isNegative('-0.01')).toBe(true);
      expect(isNegative('0.00')).toBe(false);
    });

    it('compares amounts accurately', () => {
      expect(compareMoney('100.00', '50.00')).toBe(1);
      expect(compareMoney('50.00', '100.00')).toBe(-1);
      expect(compareMoney('100.00', '100.00')).toBe(0);

      expect(isEqual('100.00', '100')).toBe(true);
      expect(isGreaterThan('100.01', '100.00')).toBe(true);
      expect(isGreaterThanOrEqualTo('100.00', '100.00')).toBe(true);
      expect(isLessThan('99.99', '100.00')).toBe(true);
      expect(isLessThanOrEqualTo('100.00', '100.00')).toBe(true);
    });

    it('returns min and max amounts', () => {
      expect(formatMoney(minMoney('100.00', '50.00'))).toBe('50.00');
      expect(formatMoney(maxMoney('100.00', '50.00'))).toBe('100.00');
    });
  });
});
