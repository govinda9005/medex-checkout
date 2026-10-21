import Decimal from 'decimal.js';

/**
 * Configure an isolated Decimal constructor specifically tuned for financial
 * calculations in Thai Baht (THB).
 *
 * Rules:
 * - Rounding mode: ROUND_HALF_UP (0.125 -> 0.13, 1.005 -> 1.01)
 * - Precision: 28 significant digits (prevents precision loss in multi-step divisions)
 */
export const MoneyDecimal = Decimal.clone({
  rounding: Decimal.ROUND_HALF_UP,
  precision: 28,
  toExpNeg: -14,
  toExpPos: 28
});

export type MoneyInput = Decimal | string | number;

/**
 * Safely parse a value into a MoneyDecimal.
 * Rejects non-numeric strings, NaN, and Infinity.
 */
export function parseMoney(value: MoneyInput): Decimal {
  if (value instanceof Decimal) {
    return new MoneyDecimal(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid money amount: non-finite number '${value}'`);
    }
    return new MoneyDecimal(value.toString());
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || !/^-?\d+(\.\d+)?$/.test(trimmed)) {
      throw new Error(`Invalid money string format: '${value}'`);
    }
    return new MoneyDecimal(trimmed);
  }
  throw new Error(`Invalid money input type: ${typeof value}`);
}

/**
 * Rounds a monetary value to 2 decimal places using ROUND_HALF_UP.
 */
export function roundMoney(value: MoneyInput): Decimal {
  return parseMoney(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Format a monetary amount to a string with exactly 2 decimal places.
 * Example: "3450.50", "0.10", "1200.00"
 */
export function formatMoney(value: MoneyInput): string {
  return roundMoney(value).toFixed(2);
}

/**
 * Format a monetary amount with thousands separators and 2 decimal places.
 * Used for user-facing messages, e.g. "Spend ฿1,234.50 more on eligible items".
 * Example: 1234.5 -> "1,234.50"
 */
export function formatMoneyWithCommas(value: MoneyInput): string {
  const [integerPart, decimalPart] = formatMoney(value).split('.');
  const withCommas = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${withCommas}.${decimalPart}`;
}

/**
 * Multiplies a unit price by quantity.
 */
export function multiplyMoney(price: MoneyInput, quantity: number | string | Decimal): Decimal {
  const p = parseMoney(price);
  const q = parseMoney(quantity);
  return p.times(q);
}

/**
 * Sums an arbitrary list of monetary amounts.
 */
export function addMoney(...values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((sum, val) => sum.plus(parseMoney(val)), new MoneyDecimal(0));
}

/**
 * Subtracts one or more amounts from a base amount.
 */
export function subtractMoney(base: MoneyInput, ...subtrahends: MoneyInput[]): Decimal {
  const start = parseMoney(base);
  return subtrahends.reduce<Decimal>((diff, val) => diff.minus(parseMoney(val)), start);
}

/**
 * Calculates a percentage of an amount and rounds half up to 2 decimals.
 * Formula: round(amount * percent / 100)
 */
export function percentOf(amount: MoneyInput, percent: MoneyInput): Decimal {
  const amt = parseMoney(amount);
  const pct = parseMoney(percent);
  const raw = amt.times(pct).dividedBy(100);
  return roundMoney(raw);
}

/**
 * Calculates 7% VAT using ROUND_HALF_UP.
 * Formula: round(netAmount * 7 / 100)
 */
export function calculateVat(netAmount: MoneyInput): Decimal {
  return percentOf(netAmount, '7');
}

/**
 * Checks if amount is exactly zero.
 */
export function isZero(value: MoneyInput): boolean {
  return parseMoney(value).isZero();
}

/**
 * Checks if amount is strictly greater than zero.
 */
export function isPositive(value: MoneyInput): boolean {
  return parseMoney(value).isPositive() && !isZero(value);
}

/**
 * Checks if amount is strictly less than zero.
 */
export function isNegative(value: MoneyInput): boolean {
  return parseMoney(value).isNegative() && !isZero(value);
}

/**
 * Compares two monetary amounts.
 * Returns -1 if a < b, 0 if a == b, 1 if a > b.
 */
export function compareMoney(a: MoneyInput, b: MoneyInput): number {
  return parseMoney(a).comparedTo(parseMoney(b));
}

/**
 * Checks if a equals b.
 */
export function isEqual(a: MoneyInput, b: MoneyInput): boolean {
  return parseMoney(a).equals(parseMoney(b));
}

/**
 * Checks if a > b.
 */
export function isGreaterThan(a: MoneyInput, b: MoneyInput): boolean {
  return parseMoney(a).greaterThan(parseMoney(b));
}

/**
 * Checks if a >= b.
 */
export function isGreaterThanOrEqualTo(a: MoneyInput, b: MoneyInput): boolean {
  return parseMoney(a).greaterThanOrEqualTo(parseMoney(b));
}

/**
 * Checks if a < b.
 */
export function isLessThan(a: MoneyInput, b: MoneyInput): boolean {
  return parseMoney(a).lessThan(parseMoney(b));
}

/**
 * Checks if a <= b.
 */
export function isLessThanOrEqualTo(a: MoneyInput, b: MoneyInput): boolean {
  return parseMoney(a).lessThanOrEqualTo(parseMoney(b));
}

/**
 * Returns minimum of two amounts.
 */
export function minMoney(a: MoneyInput, b: MoneyInput): Decimal {
  const da = parseMoney(a);
  const db = parseMoney(b);
  return da.lessThan(db) ? da : db;
}

/**
 * Returns maximum of two amounts.
 */
export function maxMoney(a: MoneyInput, b: MoneyInput): Decimal {
  const da = parseMoney(a);
  const db = parseMoney(b);
  return da.greaterThan(db) ? da : db;
}
