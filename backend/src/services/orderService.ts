import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { CatalogRepository } from '../repositories/catalogRepository.js';
import { calculateQuote } from './checkoutEngine.js';
import { QuoteRequest, QuoteResult } from '../types/index.js';
import { formatMoneyWithCommas } from '../utils/money.js';

export interface PlaceOrderRequest extends QuoteRequest {
  expectedAppliedCodes?: string[];
}

export interface PlacedOrder {
  orderId: string;
  status: 'confirmed';
  customerId: string | null;
  subtotal: string;
  discountTotal: string;
  netAmount: string;
  vat: string;
  total: string;
  lines: QuoteResult['lines'];
  coupons: QuoteResult['coupons'];
  createdAt: string;
}

export class StaleQuoteConflictError extends Error {
  statusCode = 409;
  updatedQuote: QuoteResult;
  changedCoupons: string[];

  constructor(message: string, updatedQuote: QuoteResult, changedCoupons: string[] = []) {
    super(message);
    this.name = 'StaleQuoteConflictError';
    this.updatedQuote = updatedQuote;
    this.changedCoupons = changedCoupons;
  }
}

export class OrderService {
  constructor(
    private db: Database.Database,
    private catalogRepo: CatalogRepository
  ) {}

  /**
   * Places an order safely within an immediate SQLite transaction, ensuring:
   * 1. The quote is recalculated against fresh database state.
   * 2. Stale quote detection: if any coupon is rejected or total has changed,
   *    returns HTTP 409 with the revised quote unless client confirmed via expectedTotal.
   * 3. Atomic conditional updates on coupon usage limits and customer limits.
   * 4. Customer order count is safely incremented.
   * 5. Order and line breakdown are persisted.
   */
  placeOrder(request: PlaceOrderRequest): PlacedOrder {
    // 1. Fetch fresh catalog from DB and recalculate quote
    const initialCatalog = this.catalogRepo.getFullCatalog();
    const quote = calculateQuote(initialCatalog, request);

    // 2. Check for Stale Quote Conflicts (HTTP 409)
    // Check if expectedTotal was provided and differs from the recalculated quote
    if (request.expectedTotal !== undefined && request.expectedTotal !== quote.total) {
      const changed = quote.coupons
        .filter((c) => c.status === 'rejected')
        .map((c) => c.code);

      const msg =
        changed.length > 0
          ? `${changed.join(', ')} is no longer available; your total is now ฿${formatMoneyWithCommas(quote.total)}`
          : `Quote total has changed to ฿${formatMoneyWithCommas(quote.total)}`;

      throw new StaleQuoteConflictError(msg, quote, changed);
    }

    // Check if expectedAppliedCodes was provided and any of them is now rejected
    if (request.expectedAppliedCodes && Array.isArray(request.expectedAppliedCodes)) {
      const rejectedExpected = quote.coupons.filter(
        (c) => request.expectedAppliedCodes!.includes(c.code) && c.status === 'rejected'
      );

      if (rejectedExpected.length > 0) {
        const codes = rejectedExpected.map((c) => c.code);
        const msg = `${codes.join(', ')} is no longer available; your total is now ฿${formatMoneyWithCommas(quote.total)}`;
        throw new StaleQuoteConflictError(msg, quote, codes);
      }
    }

    // If any coupon submitted by customer is rejected, and customer has not explicitly
    // confirmed the unapplied state via matching expectedTotal, trigger 409 conflict
    const rejectedCoupons = quote.coupons.filter((c) => c.status === 'rejected');
    if (
      rejectedCoupons.length > 0 &&
      (request.expectedTotal === undefined || request.expectedTotal !== quote.total)
    ) {
      const codes = rejectedCoupons.map((c) => c.code);
      const msg = `${codes.join(', ')} is no longer available; your total is now ฿${formatMoneyWithCommas(quote.total)}`;
      throw new StaleQuoteConflictError(msg, quote, codes);
    }

    // 3. Execute Transaction with Immediate Lock to prevent race conditions
    const orderId = `ord_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();

    const orderTx = this.db.transaction(() => {
      // a. Atomically redeem each applied coupon
      for (const couponResult of quote.coupons) {
        if (couponResult.status !== 'applied') continue;

        const code = couponResult.code;
        const coupon = initialCatalog.coupons.find((c) => c.code === code);
        if (!coupon) {
          throw new StaleQuoteConflictError(`Coupon ${code} not found`, quote, [code]);
        }

        // Global usage limit: atomic conditional increment
        const updateCouponStmt = this.db.prepare(`
          UPDATE coupons
          SET used_count = used_count + 1
          WHERE code = ?
            AND (usage_limit IS NULL OR used_count < usage_limit)
        `);
        const updateResult = updateCouponStmt.run(code);

        if (updateResult.changes === 0) {
          // Concurrency race: another order consumed the final usage limit
          const freshCatalog = this.catalogRepo.getFullCatalog();
          const freshQuote = calculateQuote(freshCatalog, request);
          throw new StaleQuoteConflictError(
            `${code} has been fully used; your total is now ฿${formatMoneyWithCommas(freshQuote.total)}`,
            freshQuote,
            [code]
          );
        }

        // Per-customer limit: atomic conditional upsert
        if (coupon.perCustomerLimit !== null && request.customerId) {
          const upsertUsageStmt = this.db.prepare(`
            INSERT INTO coupon_usages (coupon_code, customer_id, used_count)
            VALUES (?, ?, 1)
            ON CONFLICT(coupon_code, customer_id) DO UPDATE SET
              used_count = coupon_usages.used_count + 1
            WHERE coupon_usages.used_count < ?
          `);
          const usageResult = upsertUsageStmt.run(
            code,
            request.customerId,
            coupon.perCustomerLimit
          );

          if (usageResult.changes === 0) {
            const freshCatalog = this.catalogRepo.getFullCatalog();
            const freshQuote = calculateQuote(freshCatalog, request);
            throw new StaleQuoteConflictError(
              `You've already used ${code}; your total is now ฿${formatMoneyWithCommas(freshQuote.total)}`,
              freshQuote,
              [code]
            );
          }
        }

        // First-order-only check inside transaction
        if (coupon.firstOrderOnly && request.customerId) {
          const cust = this.db
            .prepare('SELECT orders_count FROM customers WHERE id = ?')
            .get(request.customerId) as { orders_count: number } | undefined;

          if (cust && cust.orders_count > 0) {
            const freshCatalog = this.catalogRepo.getFullCatalog();
            const freshQuote = calculateQuote(freshCatalog, request);
            throw new StaleQuoteConflictError(
              `${code} is only for your first order; your total is now ฿${formatMoneyWithCommas(freshQuote.total)}`,
              freshQuote,
              [code]
            );
          }
        }
      }

      // b. Update customer order count if customer is logged in
      if (request.customerId) {
        this.db
          .prepare('UPDATE customers SET orders_count = orders_count + 1 WHERE id = ?')
          .run(request.customerId);
      }

      // c. Persist order
      this.db
        .prepare(`
          INSERT INTO orders (id, customer_id, subtotal, discount_total, net_amount, vat, total, created_at, quote_data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          orderId,
          request.customerId || null,
          quote.subtotal,
          quote.discountTotal,
          quote.netAmount,
          quote.vat,
          quote.total,
          createdAt,
          JSON.stringify(quote)
        );

      // d. Persist order items
      const insertItemStmt = this.db.prepare(`
        INSERT INTO order_items (order_id, service_id, quantity, amount, amount_after_discounts)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const line of quote.lines) {
        insertItemStmt.run(
          orderId,
          line.serviceId,
          line.quantity,
          line.amount,
          line.amountAfterDiscounts
        );
      }

      // e. Persist applied coupons
      const insertCouponStmt = this.db.prepare(`
        INSERT INTO order_coupons (order_id, coupon_code, discount)
        VALUES (?, ?, ?)
      `);
      for (const coupon of quote.coupons) {
        if (coupon.status === 'applied') {
          insertCouponStmt.run(orderId, coupon.code, coupon.discount);
        }
      }

      return {
        orderId,
        status: 'confirmed' as const,
        customerId: request.customerId || null,
        subtotal: quote.subtotal,
        discountTotal: quote.discountTotal,
        netAmount: quote.netAmount,
        vat: quote.vat,
        total: quote.total,
        lines: quote.lines,
        coupons: quote.coupons,
        createdAt
      };
    });

    // Execute with immediate lock
    return orderTx.immediate();
  }
}
