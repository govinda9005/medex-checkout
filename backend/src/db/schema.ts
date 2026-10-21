/**
 * SQLite table definitions for MedEx checkout persistence.
 */

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  provider_id INTEGER NOT NULL,
  provider_name TEXT NOT NULL,
  price TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  orders_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  max_discount TEXT,
  min_spend TEXT NOT NULL,
  scope_kind TEXT NOT NULL,
  scope_value TEXT,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  per_customer_limit INTEGER,
  first_order_only INTEGER NOT NULL DEFAULT 0,
  stackable INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS coupon_usages (
  coupon_code TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (coupon_code, customer_id),
  FOREIGN KEY (coupon_code) REFERENCES coupons(code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  subtotal TEXT NOT NULL,
  discount_total TEXT NOT NULL,
  net_amount TEXT NOT NULL,
  vat TEXT NOT NULL,
  total TEXT NOT NULL,
  created_at TEXT NOT NULL,
  quote_data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  amount TEXT NOT NULL,
  amount_after_discounts TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  coupon_code TEXT NOT NULL,
  discount TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
`;
