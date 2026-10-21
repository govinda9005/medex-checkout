import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { CREATE_TABLES_SQL } from './schema.js';
import { CheckoutCatalog, Coupon } from '../types/index.js';

export interface DatabaseOptions {
  dbPath?: string;
  fixturePath?: string;
  forceSeed?: boolean;
}

/**
 * Initializes and configures an SQLite database instance with WAL mode,
 * foreign keys enabled, and automatic repeatable seeding from the checkout fixture.
 */
export function createDatabase(options: DatabaseOptions = {}): Database.Database {
  const dbPath =
    options.dbPath ||
    process.env.DB_PATH ||
    path.resolve(process.cwd(), 'checkout.db');

  // Ensure parent directory exists for file-based DBs
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath);

  // High performance & concurrency settings
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Apply schema
  db.exec(CREATE_TABLES_SQL);

  // Check if seeding is needed
  const serviceCountRow = db
    .prepare('SELECT COUNT(*) as count FROM services')
    .get() as { count: number };

  const needsSeeding = options.forceSeed || serviceCountRow.count === 0;

  if (needsSeeding) {
    const fixtureFile =
      options.fixturePath ||
      process.env.FIXTURE_PATH ||
      path.resolve(process.cwd(), '../data/checkout.json');

    seedDatabaseFromFixture(db, fixtureFile);
  }

  return db;
}

/**
 * Seeds catalog tables from the authoritative checkout.json fixture.
 */
export function seedDatabaseFromFixture(db: Database.Database, fixturePath: string): void {
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Checkout fixture not found at path: ${fixturePath}`);
  }

  const raw = fs.readFileSync(fixturePath, 'utf-8');
  const catalog = JSON.parse(raw) as CheckoutCatalog;

  const seedTransaction = db.transaction(() => {
    // 1. Insert Services
    const insertService = db.prepare(`
      INSERT OR REPLACE INTO services (id, title, type, provider_id, provider_name, price)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const s of catalog.services) {
      insertService.run(s.id, s.title, s.type, s.providerId, s.providerName, s.price);
    }

    // 2. Insert Customers
    const insertCustomer = db.prepare(`
      INSERT OR REPLACE INTO customers (id, name, orders_count)
      VALUES (?, ?, ?)
    `);
    for (const c of catalog.customers) {
      insertCustomer.run(c.id, c.name, c.ordersCount);
    }

    // 3. Insert Coupons
    const insertCoupon = db.prepare(`
      INSERT OR REPLACE INTO coupons (
        code, type, value, max_discount, min_spend,
        scope_kind, scope_value, starts_on, ends_on,
        usage_limit, used_count, per_customer_limit,
        first_order_only, stackable, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertUsage = db.prepare(`
      INSERT OR REPLACE INTO coupon_usages (coupon_code, customer_id, used_count)
      VALUES (?, ?, ?)
    `);

    for (const c of catalog.coupons) {
      const scopeKind = c.scope.kind;
      const scopeValue = 'value' in c.scope ? String(c.scope.value) : null;

      insertCoupon.run(
        c.code.trim().toUpperCase(),
        c.type,
        c.value,
        c.maxDiscount,
        c.minSpend,
        scopeKind,
        scopeValue,
        c.startsOn,
        c.endsOn,
        c.usageLimit,
        c.usedCount,
        c.perCustomerLimit,
        c.firstOrderOnly ? 1 : 0,
        c.stackable ? 1 : 0,
        c.status
      );

      // Seed initial usedBy counts
      if (c.usedBy && typeof c.usedBy === 'object') {
        for (const [customerId, count] of Object.entries(c.usedBy)) {
          insertUsage.run(c.code.trim().toUpperCase(), customerId, count);
        }
      }
    }
  });

  seedTransaction();
}
