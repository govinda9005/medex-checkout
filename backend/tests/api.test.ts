import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/db/database.js';
import { CheckoutCatalog, QuoteRequest } from '../types/index.js';

const fixturePath = path.resolve(process.cwd(), '../data/checkout.json');
const rawFixture = fs.readFileSync(fixturePath, 'utf-8');
const fixture = JSON.parse(rawFixture) as CheckoutCatalog & {
  examples: Array<{
    request: QuoteRequest;
    expected: any;
  }>;
};

describe('API Integration & Acceptance Tests', () => {
  const testDir = path.resolve(process.cwd(), 'test-dbs');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  function getUniqueDb() {
    const dbPath = path.resolve(testDir, `api-test-${crypto.randomUUID()}.db`);
    const db = createDatabase({ dbPath, fixturePath });
    const app = createApp({ db });
    return { db, app, dbPath };
  }

  describe('GET /api/services', () => {
    it('returns all available services with exact pricing and metadata', async () => {
      const { db, app, dbPath } = getUniqueDb();
      const res = await request(app).get('/api/services');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(6);

      const s1 = res.body.find((s: any) => s.id === 'S1');
      expect(s1).toBeDefined();
      expect(s1.title).toBe('Thyroid Function Test');
      expect(s1.price).toBe('1200.00');
      expect(s1.providerId).toBe(48);

      db.close();
      try { fs.unlinkSync(dbPath); } catch {}
    });
  });

  describe('POST /api/quote Acceptance Examples', () => {
    it('Example 1: returns exact expected response for WELCOME10 on S1 + S2', async () => {
      const { db, app, dbPath } = getUniqueDb();
      const example = fixture.examples[0];

      const res = await request(app)
        .post('/api/quote')
        .send(example.request);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(example.expected);

      db.close();
      try { fs.unlinkSync(dbPath); } catch {}
    });

    it('Example 2: returns exact expected response for LAB15 + RIVER200', async () => {
      const { db, app, dbPath } = getUniqueDb();
      const example = fixture.examples[1];

      const res = await request(app)
        .post('/api/quote')
        .send(example.request);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(example.expected);

      db.close();
      try { fs.unlinkSync(dbPath); } catch {}
    });

    it('Example 3: returns exact expected response for SPA50 + expired FLASH25', async () => {
      const { db, app, dbPath } = getUniqueDb();
      const example = fixture.examples[2];

      const res = await request(app)
        .post('/api/quote')
        .send(example.request);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(example.expected);

      db.close();
      try { fs.unlinkSync(dbPath); } catch {}
    });
  });

  describe('POST /api/quote Input Validation', () => {
    it('returns HTTP 400 for unknown serviceId', async () => {
      const { db, app, dbPath } = getUniqueDb();

      const res = await request(app)
        .post('/api/quote')
        .send({
          lines: [{ serviceId: 'DOES_NOT_EXIST', quantity: 1 }],
          couponCodes: []
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Unknown serviceId: 'DOES_NOT_EXIST'");

      db.close();
      try { fs.unlinkSync(dbPath); } catch {}
    });

    it('returns HTTP 400 for invalid quantities (<1, >20, or decimal)', async () => {
      const { db, app, dbPath } = getUniqueDb();

      const resZero = await request(app)
        .post('/api/quote')
        .send({ lines: [{ serviceId: 'S1', quantity: 0 }] });
      expect(resZero.status).toBe(400);

      const resTooLarge = await request(app)
        .post('/api/quote')
        .send({ lines: [{ serviceId: 'S1', quantity: 21 }] });
      expect(resTooLarge.status).toBe(400);

      const resDecimal = await request(app)
        .post('/api/quote')
        .send({ lines: [{ serviceId: 'S1', quantity: 1.5 }] });
      expect(resDecimal.status).toBe(400);

      db.close();
      try { fs.unlinkSync(dbPath); } catch {}
    });

    it('returns HTTP 400 for empty cart', async () => {
      const { db, app, dbPath } = getUniqueDb();

      const res = await request(app)
        .post('/api/quote')
        .send({ lines: [] });

      expect(res.status).toBe(400);

      db.close();
      try { fs.unlinkSync(dbPath); } catch {}
    });
  });

  describe('POST /api/orders Lifecycle & Conflict Handling', () => {
    it('places an order successfully and returns 201 Created with confirmation', async () => {
      const { db, app, dbPath } = getUniqueDb();

      const res = await request(app)
        .post('/api/orders')
        .send({
          lines: [{ serviceId: 'S1', quantity: 1 }],
          couponCodes: ['WELCOME10'],
          customerId: 'C1',
          at: '2026-11-02T10:00:00+07:00'
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('confirmed');
      expect(res.body.orderId).toMatch(/^ord_/);
      expect(res.body.total).toBe('1155.60');
      expect(res.body.lines.length).toBe(1);

      db.close();
      try { fs.unlinkSync(dbPath); } catch {}
    });

    it('returns HTTP 409 Conflict when a previously applicable coupon is no longer available', async () => {
      const { db, app, dbPath } = getUniqueDb();

      // Exhaust LASTONE (1 redemption left) with customer C1
      const res1 = await request(app)
        .post('/api/orders')
        .send({
          lines: [{ serviceId: 'S1', quantity: 1 }],
          couponCodes: ['LASTONE'],
          customerId: 'C1',
          at: '2026-11-02T10:00:00+07:00'
        });
      expect(res1.status).toBe(201);

      // Customer C3 attempts to place order with LASTONE
      const res2 = await request(app)
        .post('/api/orders')
        .send({
          lines: [{ serviceId: 'S1', quantity: 1 }],
          couponCodes: ['LASTONE'],
          customerId: 'C3',
          at: '2026-11-02T10:00:00+07:00'
        });

      expect(res2.status).toBe(409);
      expect(res2.body.error).toBe('Quote Conflict');
      expect(res2.body.message).toContain('LASTONE is no longer available');
      expect(res2.body.quote).toBeDefined();
      expect(res2.body.quote.coupons[0].reason).toBe('This code has been fully used.');

      // Customer C3 confirms the revised quote using expectedTotal
      const resConfirm = await request(app)
        .post('/api/orders')
        .send({
          lines: [{ serviceId: 'S1', quantity: 1 }],
          couponCodes: ['LASTONE'],
          customerId: 'C3',
          at: '2026-11-02T10:00:00+07:00',
          expectedTotal: res2.body.quote.total
        });

      expect(resConfirm.status).toBe(201);
      expect(resConfirm.body.status).toBe('confirmed');
      expect(resConfirm.body.total).toBe(res2.body.quote.total);

      db.close();
      try { fs.unlinkSync(dbPath); } catch {}
    });
  });

  describe('GET /api/customers & GET /api/coupons', () => {
    it('returns customers and coupons for frontend switcher', async () => {
      const { db, app, dbPath } = getUniqueDb();

      const custRes = await request(app).get('/api/customers');
      expect(custRes.status).toBe(200);
      expect(custRes.body.length).toBe(3);

      const coupRes = await request(app).get('/api/coupons');
      expect(coupRes.status).toBe(200);
      expect(coupRes.body.length).toBe(12);

      db.close();
      try { fs.unlinkSync(dbPath); } catch {}
    });
  });
});
