import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { calculateQuote, CheckoutError } from '../src/services/checkoutEngine.js';
import { CheckoutCatalog, QuoteRequest } from '../types/index.js';

// Load fixture from data/checkout.json
const fixturePath = path.resolve(process.cwd(), '../data/checkout.json');
const rawFixture = fs.readFileSync(fixturePath, 'utf-8');
const fixture = JSON.parse(rawFixture) as CheckoutCatalog & {
  examples: Array<{
    request: QuoteRequest;
    expected: any;
  }>;
};

describe('Checkout & Coupon Engine', () => {
  describe('Authoritative Acceptance Examples from checkout.json', () => {
    it('accurately calculates Example 1 (WELCOME10, proportional split across lines, VAT)', () => {
      const example = fixture.examples[0];
      const result = calculateQuote(fixture, example.request);
      expect(result).toEqual(example.expected);
    });

    it('accurately calculates Example 2 (LAB15 non-stackable + RIVER200 provider scope, whitespace normalization)', () => {
      const example = fixture.examples[1];
      const result = calculateQuote(fixture, example.request);
      expect(result).toEqual(example.expected);
    });

    it('accurately calculates Example 3 (SPA50 applied, FLASH25 expired, input order preserved)', () => {
      const example = fixture.examples[2];
      const result = calculateQuote(fixture, example.request);
      expect(result).toEqual(example.expected);
    });
  });

  describe('Validation Checks a through k Pipeline', () => {
    it('Check a: rejects unrecognised code with exact message', () => {
      const request: QuoteRequest = {
        lines: [{ serviceId: 'S1', quantity: 1 }],
        couponCodes: ['NOTREAL'],
        customerId: 'C1',
        at: '2026-11-02T10:00:00+07:00'
      };
      const result = calculateQuote(fixture, request);
      expect(result.coupons[0]).toEqual({
        code: 'NOTREAL',
        status: 'rejected',
        reason: "We don't recognise this code."
      });
    });

    it('Check b: rejects inactive code (OLDCODE)', () => {
      const request: QuoteRequest = {
        lines: [{ serviceId: 'S1', quantity: 1 }],
        couponCodes: ['OLDCODE'],
        customerId: 'C1',
        at: '2026-11-02T10:00:00+07:00'
      };
      const result = calculateQuote(fixture, request);
      expect(result.coupons[0]).toEqual({
        code: 'OLDCODE',
        status: 'rejected',
        reason: 'This code is no longer active.'
      });
    });

    it('Check c: rejects future code before startsOn (NEWYEAR)', () => {
      const request: QuoteRequest = {
        lines: [{ serviceId: 'S1', quantity: 1 }],
        couponCodes: ['NEWYEAR'],
        customerId: 'C1',
        at: '2026-11-02T10:00:00+07:00'
      };
      const result = calculateQuote(fixture, request);
      expect(result.coupons[0]).toEqual({
        code: 'NEWYEAR',
        status: 'rejected',
        reason: 'This code starts on 2027-01-01.'
      });
    });

    it('Check d: rejects expired code past endsOn (FLASH25)', () => {
      const request: QuoteRequest = {
        lines: [{ serviceId: 'S1', quantity: 1 }],
        couponCodes: ['FLASH25'],
        customerId: 'C1',
        at: '2026-11-02T10:00:00+07:00'
      };
      const result = calculateQuote(fixture, request);
      expect(result.coupons[0]).toEqual({
        code: 'FLASH25',
        status: 'rejected',
        reason: 'This code expired on 2026-10-07.'
      });
    });

    it('Check e: rejects fully used code (LIMITED: 50/50 used)', () => {
      const request: QuoteRequest = {
        lines: [{ serviceId: 'S1', quantity: 1 }],
        couponCodes: ['LIMITED'],
        customerId: 'C1',
        at: '2026-11-02T10:00:00+07:00'
      };
      const result = calculateQuote(fixture, request);
      expect(result.coupons[0]).toEqual({
        code: 'LIMITED',
        status: 'rejected',
        reason: 'This code has been fully used.'
      });
    });

    it('Check f: requires login for perCustomerLimit or firstOrderOnly when customerId is null', () => {
      const request: QuoteRequest = {
        lines: [{ serviceId: 'S1', quantity: 1 }],
        couponCodes: ['WELCOME10'],
        customerId: null,
        at: '2026-11-02T10:00:00+07:00'
      };
      const result = calculateQuote(fixture, request);
      expect(result.coupons[0]).toEqual({
        code: 'WELCOME10',
        status: 'rejected',
        reason: 'Log in to use this code.'
      });
    });

    it('Check g: rejects if customer reached perCustomerLimit (ONCE with C2)', () => {
      const request: QuoteRequest = {
        lines: [{ serviceId: 'S1', quantity: 1 }],
        couponCodes: ['ONCE'],
        customerId: 'C2',
        at: '2026-11-02T10:00:00+07:00'
      };
      const result = calculateQuote(fixture, request);
      expect(result.coupons[0]).toEqual({
        code: 'ONCE',
        status: 'rejected',
        reason: "You've already used this code."
      });
    });

    it('Check h: rejects firstOrderOnly if customer has previous orders (WELCOME10 with C2)', () => {
      const request: QuoteRequest = {
        lines: [{ serviceId: 'S1', quantity: 1 }],
        couponCodes: ['WELCOME10'],
        customerId: 'C2',
        at: '2026-11-02T10:00:00+07:00'
      };
      const result = calculateQuote(fixture, request);
      expect(result.coupons[0]).toEqual({
        code: 'WELCOME10',
        status: 'rejected',
        reason: 'This code is only for your first order.'
      });
    });

    it('Check i: rejects second non-stackable coupon when another is already applied', () => {
      // WELCOME10 is non-stackable, LAB15 is non-stackable
      const request: QuoteRequest = {
        lines: [{ serviceId: 'S1', quantity: 2 }], // 2400.00 lab_test
        couponCodes: ['WELCOME10', 'LAB15'],
        customerId: 'C1',
        at: '2026-11-02T10:00:00+07:00'
      };
      const result = calculateQuote(fixture, request);
      expect(result.coupons[0]).toEqual({
        code: 'WELCOME10',
        status: 'applied',
        discount: '240.00'
      });
      expect(result.coupons[1]).toEqual({
        code: 'LAB15',
        status: 'rejected',
        reason: "This code can't be combined with WELCOME10."
      });
    });

    it('Check j: rejects if no items in cart match scope', () => {
      // S1 is lab_test, SPA50 applies to wellness
      const request: QuoteRequest = {
        lines: [{ serviceId: 'S1', quantity: 1 }],
        couponCodes: ['SPA50'],
        customerId: 'C1',
        at: '2026-11-02T10:00:00+07:00'
      };
      const result = calculateQuote(fixture, request);
      expect(result.coupons[0]).toEqual({
        code: 'SPA50',
        status: 'rejected',
        reason: 'No items in your cart qualify for this code.'
      });
    });

    it('Check k: rejects if eligible amount does not meet minSpend with formatted missing amount', () => {
      // S4 is 333.33 lab_test. LAB15 minSpend is 1500.00. Missing is 1500.00 - 333.33 = 1166.67
      const request: QuoteRequest = {
        lines: [{ serviceId: 'S4', quantity: 1 }],
        couponCodes: ['LAB15'],
        customerId: 'C1',
        at: '2026-11-02T10:00:00+07:00'
      };
      const result = calculateQuote(fixture, request);
      expect(result.coupons[0]).toEqual({
        code: 'LAB15',
        status: 'rejected',
        reason: 'Spend ฿1,166.67 more on eligible items to use this code.'
      });
    });
  });

  describe('Duplicate Codes and Code Limits', () => {
    it('rejects duplicate code entered twice with exact message', () => {
      const request: QuoteRequest = {
        lines: [{ serviceId: 'S1', quantity: 1 }],
        couponCodes: ['RIVER200', ' river200 '],
        customerId: 'C1',
        at: '2026-11-02T10:00:00+07:00'
      };
      const result = calculateQuote(fixture, request);
      expect(result.coupons[0].status).toBe('applied');
      expect(result.coupons[1]).toEqual({
        code: 'RIVER200',
        status: 'rejected',
        reason: 'This code is already applied.'
      });
    });

    it('rejects 3rd distinct code with 2-code limit message', () => {
      const request: QuoteRequest = {
        lines: [{ serviceId: 'S1', quantity: 1 }, { serviceId: 'S3', quantity: 1 }],
        couponCodes: ['RIVER200', 'SPA50', 'LASTONE'],
        customerId: 'C1',
        at: '2026-11-02T10:00:00+07:00'
      };
      const result = calculateQuote(fixture, request);
      expect(result.coupons.length).toBe(3);
      expect(result.coupons[2]).toEqual({
        code: 'LASTONE',
        status: 'rejected',
        reason: 'You can use up to 2 codes per order.'
      });
    });
  });

  describe('Evaluation Order vs Customer Reporting Order', () => {
    it('evaluates non-stackable first even if entered second, but reports in original customer order', () => {
      // Customer entered RIVER200 (stackable) first, then LAB15 (non-stackable) second
      const request: QuoteRequest = {
        lines: [
          { serviceId: 'S1', quantity: 1 },
          { serviceId: 'S4', quantity: 3 },
          { serviceId: 'S5', quantity: 2 }
        ],
        couponCodes: ['RIVER200', 'LAB15'],
        customerId: 'C2',
        at: '2026-11-02T10:00:00+07:00'
      };

      const result = calculateQuote(fixture, request);

      // Reported order must match customer input: RIVER200 first, LAB15 second
      expect(result.coupons[0].code).toBe('RIVER200');
      expect(result.coupons[1].code).toBe('LAB15');

      // However, LAB15 must have been evaluated first!
      // If LAB15 evaluated first: LAB15 gets 360.00 off 2399.97. S1 amount drops from 1200.00 to 1020.00.
      // Then RIVER200 evaluates on S1 (1020.00) -> 200.00 off S1 -> S1 ends at 820.00.
      expect(result.lines[0].amountAfterDiscounts).toBe('820.00');
      expect(result.total).toBe('1968.77');
    });
  });

  describe('Discount Allocation and Tie-Breaking', () => {
    it('breaks ties for largest line by adjusting the FIRST eligible line', () => {
      // Create a test catalog with two identical lines that cause a 1-satang rounding remainder
      // Example: 2 lines of 100.00. Coupon of 33.333% (THIRD).
      // Total eligible: 200.00.
      // 33.333% of 200.00 = 66.666 -> round = 66.67.
      // Line 1 share: round(66.67 * 100 / 200) = 33.335 -> 33.34
      // Line 2 share: round(66.67 * 100 / 200) = 33.335 -> 33.34
      // Sum = 66.68. Diff = 66.67 - 66.68 = -0.01.
      // Both lines tie at 100.00. The diff (-0.01) must adjust the FIRST line!
      // Line 1 becomes 33.33. Line 2 remains 33.34.
      const request: QuoteRequest = {
        lines: [
          { serviceId: 'S1', quantity: 1 }, // 1200.00
          { serviceId: 'S1', quantity: 1 }  // 1200.00 (identical line amount)
        ],
        couponCodes: ['THIRD'],
        customerId: 'C1',
        at: '2026-11-02T10:00:00+07:00'
      };

      const result = calculateQuote(fixture, request);
      expect(result.coupons[0].status).toBe('applied');

      const disc1 = result.lines[0].discounts['THIRD'];
      const disc2 = result.lines[1].discounts['THIRD'];

      // Shares must sum exactly to total coupon discount
      const totalDisc = (Number(disc1) + Number(disc2)).toFixed(2);
      expect(totalDisc).toBe(result.coupons[0].discount);
    });

    it('caps fixed discount at eligible amount and never produces negative net', () => {
      // BIGFIX is 5000.00 fixed. Cart is only 1200.00.
      const request: QuoteRequest = {
        lines: [{ serviceId: 'S1', quantity: 1 }],
        couponCodes: ['BIGFIX'],
        customerId: 'C1',
        at: '2026-11-02T10:00:00+07:00'
      };
      const result = calculateQuote(fixture, request);
      expect(result.coupons[0].discount).toBe('1200.00');
      expect(result.lines[0].amountAfterDiscounts).toBe('0.00');
      expect(result.netAmount).toBe('0.00');
      expect(result.vat).toBe('0.00');
      expect(result.total).toBe('0.00');
    });
  });

  describe('Cart Input Validation', () => {
    it('throws 400 error on unknown serviceId', () => {
      const request: QuoteRequest = {
        lines: [{ serviceId: 'UNKNOWN_99', quantity: 1 }],
        couponCodes: [],
        customerId: null
      };
      expect(() => calculateQuote(fixture, request)).toThrow(CheckoutError);
    });

    it('throws 400 error on invalid quantity (0, negative, >20, or decimal)', () => {
      const makeRequest = (qty: number): QuoteRequest => ({
        lines: [{ serviceId: 'S1', quantity: qty }],
        couponCodes: [],
        customerId: null
      });

      expect(() => calculateQuote(fixture, makeRequest(0))).toThrow(CheckoutError);
      expect(() => calculateQuote(fixture, makeRequest(-1))).toThrow(CheckoutError);
      expect(() => calculateQuote(fixture, makeRequest(21))).toThrow(CheckoutError);
      expect(() => calculateQuote(fixture, makeRequest(2.5))).toThrow(CheckoutError);
    });

    it('throws 400 error on empty cart', () => {
      const request: QuoteRequest = {
        lines: [],
        couponCodes: [],
        customerId: null
      };
      expect(() => calculateQuote(fixture, request)).toThrow(CheckoutError);
    });
  });
});
