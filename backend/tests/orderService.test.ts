import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createDatabase } from '../src/db/database.js';
import { CatalogRepository } from '../src/repositories/catalogRepository.js';
import { OrderService, StaleQuoteConflictError } from '../src/services/orderService.js';
import { PlaceOrderRequest } from '../src/services/orderService.js';

describe('Order Service & Persistence', () => {
  const testDir = path.resolve(process.cwd(), 'test-dbs');
  const fixturePath = path.resolve(process.cwd(), '../data/checkout.json');

  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  function getUniqueDbPath(): string {
    return path.resolve(testDir, `test-${crypto.randomUUID()}.db`);
  }

  it('persists order and coupon redemptions across database re-open (simulated restart)', () => {
    const dbPath = getUniqueDbPath();

    // 1. Initial server session: create DB, seed fixture, place order
    const db1 = createDatabase({ dbPath, fixturePath });
    const repo1 = new CatalogRepository(db1);
    const service1 = new OrderService(db1, repo1);

    const request: PlaceOrderRequest = {
      lines: [{ serviceId: 'S1', quantity: 1 }],
      couponCodes: ['WELCOME10'],
      customerId: 'C1',
      at: '2026-11-02T10:00:00+07:00'
    };

    const order = service1.placeOrder(request);
    expect(order.status).toBe('confirmed');
    // S1 price: 1200.00. 10% discount = 120.00. Net = 1080.00. VAT 7% = 75.60. Total = 1155.60.
    expect(order.total).toBe('1155.60');
    db1.close();

    // 2. Simulated restart: open new connection to same file
    const db2 = createDatabase({ dbPath, fixturePath });
    const repo2 = new CatalogRepository(db2);

    const coupon = repo2.getAllCoupons().find((c) => c.code === 'WELCOME10');
    expect(coupon?.usedCount).toBe(1);

    const customer = repo2.getCustomerById('C1');
    expect(customer?.ordersCount).toBe(1);

    const ordersInDb = db2.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number };
    expect(ordersInDb.count).toBe(1);

    db2.close();
    try {
      fs.unlinkSync(dbPath);
    } catch {}
  });

  it('safely handles concurrent redemption of LASTONE (exactly 1 redemption remaining)', () => {
    const dbPath = getUniqueDbPath();
    const db = createDatabase({ dbPath, fixturePath });
    const repo = new CatalogRepository(db);
    const service = new OrderService(db, repo);

    // Initial state: LASTONE usageLimit = 10, usedCount = 9 (1 left)
    const initialCoupon = repo.getAllCoupons().find((c) => c.code === 'LASTONE');
    expect(initialCoupon?.usedCount).toBe(9);
    expect(initialCoupon?.usageLimit).toBe(10);

    const orderReq1: PlaceOrderRequest = {
      lines: [{ serviceId: 'S1', quantity: 1 }],
      couponCodes: ['LASTONE'],
      customerId: 'C1',
      at: '2026-11-02T10:00:00+07:00'
    };

    const orderReq2: PlaceOrderRequest = {
      lines: [{ serviceId: 'S1', quantity: 1 }],
      couponCodes: ['LASTONE'],
      customerId: 'C3',
      at: '2026-11-02T10:00:00+07:00'
    };

    // Customer 1 places order: succeeds
    const order1 = service.placeOrder(orderReq1);
    expect(order1.status).toBe('confirmed');

    // Customer 2 attempts to place order: MUST fail with 409 conflict
    expect(() => service.placeOrder(orderReq2)).toThrowError(StaleQuoteConflictError);

    try {
      service.placeOrder(orderReq2);
    } catch (err: any) {
      expect(err).toBeInstanceOf(StaleQuoteConflictError);
      expect(err.statusCode).toBe(409);
      expect(err.message).toContain('LASTONE is no longer available');
      // Updated quote reflects full price with no discount: 1200 * 1.07 = 1284.00
      expect(err.updatedQuote.total).toBe('1284.00');
      expect(err.updatedQuote.coupons[0].status).toBe('rejected');
      expect(err.updatedQuote.coupons[0].reason).toBe('This code has been fully used.');
    }

    // Verify database: LASTONE usedCount is exactly 10, not 11
    const updatedCoupon = repo.getAllCoupons().find((c) => c.code === 'LASTONE');
    expect(updatedCoupon?.usedCount).toBe(10);

    db.close();
    try {
      fs.unlinkSync(dbPath);
    } catch {}
  });

  it('handles simultaneous concurrent async requests for the last redemption', async () => {
    const dbPath = getUniqueDbPath();
    const db = createDatabase({ dbPath, fixturePath });
    const repo = new CatalogRepository(db);
    const service = new OrderService(db, repo);

    const orderReq1: PlaceOrderRequest = {
      lines: [{ serviceId: 'S1', quantity: 1 }],
      couponCodes: ['LASTONE'],
      customerId: 'C1',
      at: '2026-11-02T10:00:00+07:00'
    };

    const orderReq2: PlaceOrderRequest = {
      lines: [{ serviceId: 'S1', quantity: 1 }],
      couponCodes: ['LASTONE'],
      customerId: 'C3',
      at: '2026-11-02T10:00:00+07:00'
    };

    // Dispatch both orders concurrently via Promise.allSettled
    const results = await Promise.allSettled([
      Promise.resolve().then(() => service.placeOrder(orderReq1)),
      Promise.resolve().then(() => service.placeOrder(orderReq2))
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one must succeed, exactly one must fail
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectedReason).toBeInstanceOf(StaleQuoteConflictError);
    expect(rejectedReason.statusCode).toBe(409);

    const finalCoupon = repo.getAllCoupons().find((c) => c.code === 'LASTONE');
    expect(finalCoupon?.usedCount).toBe(10);

    db.close();
    try {
      fs.unlinkSync(dbPath);
    } catch {}
  });

  it('prevents firstOrderOnly coupons from being used after customer places their first order', () => {
    const dbPath = getUniqueDbPath();
    const db = createDatabase({ dbPath, fixturePath });
    const repo = new CatalogRepository(db);
    const service = new OrderService(db, repo);

    // C1 starts with 0 orders
    expect(repo.getCustomerById('C1')?.ordersCount).toBe(0);

    const firstOrderReq: PlaceOrderRequest = {
      lines: [{ serviceId: 'S1', quantity: 1 }],
      couponCodes: ['WELCOME10'],
      customerId: 'C1',
      at: '2026-11-02T10:00:00+07:00'
    };

    // First order succeeds
    const order1 = service.placeOrder(firstOrderReq);
    expect(order1.status).toBe('confirmed');
    expect(repo.getCustomerById('C1')?.ordersCount).toBe(1);

    // Second order with WELCOME10 fails with 409
    expect(() => service.placeOrder(firstOrderReq)).toThrow(StaleQuoteConflictError);

    try {
      service.placeOrder(firstOrderReq);
    } catch (err: any) {
      expect(err.statusCode).toBe(409);
      expect(err.updatedQuote.coupons[0].reason).toBe('This code is only for your first order.');
    }

    db.close();
    try {
      fs.unlinkSync(dbPath);
    } catch {}
  });

  it('enforces perCustomerLimit on repeated orders', () => {
    const dbPath = getUniqueDbPath();
    const db = createDatabase({ dbPath, fixturePath });
    const repo = new CatalogRepository(db);
    const service = new OrderService(db, repo);

    // ONCE has perCustomerLimit: 1
    // C1 has not used ONCE yet
    const orderReq: PlaceOrderRequest = {
      lines: [{ serviceId: 'S1', quantity: 1 }],
      couponCodes: ['ONCE'],
      customerId: 'C1',
      at: '2026-11-02T10:00:00+07:00'
    };

    // First use by C1 succeeds
    const order1 = service.placeOrder(orderReq);
    expect(order1.status).toBe('confirmed');

    // Second use by C1 fails with 409
    expect(() => service.placeOrder(orderReq)).toThrow(StaleQuoteConflictError);

    db.close();
    try {
      fs.unlinkSync(dbPath);
    } catch {}
  });

  it('allows customer to confirm revised order after 409 conflict', () => {
    const dbPath = getUniqueDbPath();
    const db = createDatabase({ dbPath, fixturePath });
    const repo = new CatalogRepository(db);
    const service = new OrderService(db, repo);

    // Exhaust LASTONE
    service.placeOrder({
      lines: [{ serviceId: 'S1', quantity: 1 }],
      couponCodes: ['LASTONE'],
      customerId: 'C1',
      at: '2026-11-02T10:00:00+07:00'
    });

    // Customer C3 tries to use LASTONE expecting old discounted total 1177.00
    const conflictingReq: PlaceOrderRequest = {
      lines: [{ serviceId: 'S1', quantity: 1 }],
      couponCodes: ['LASTONE'],
      customerId: 'C3',
      at: '2026-11-02T10:00:00+07:00',
      expectedTotal: '1177.00'
    };

    let revisedTotal = '';
    try {
      service.placeOrder(conflictingReq);
    } catch (err: any) {
      expect(err.statusCode).toBe(409);
      revisedTotal = err.updatedQuote.total; // '1284.00'
    }

    // Customer confirms the revised total and submits with expectedTotal = revisedTotal
    const confirmedReq: PlaceOrderRequest = {
      lines: [{ serviceId: 'S1', quantity: 1 }],
      couponCodes: ['LASTONE'],
      customerId: 'C3',
      at: '2026-11-02T10:00:00+07:00',
      expectedTotal: revisedTotal
    };

    const confirmedOrder = service.placeOrder(confirmedReq);
    expect(confirmedOrder.status).toBe('confirmed');
    expect(confirmedOrder.total).toBe(revisedTotal);

    db.close();
    try {
      fs.unlinkSync(dbPath);
    } catch {}
  });
});
