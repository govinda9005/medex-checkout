import Database from 'better-sqlite3';
import {
  Service,
  Customer,
  Coupon,
  CouponScope,
  CheckoutCatalog
} from '../types/index.js';

interface ServiceRow {
  id: string;
  title: string;
  type: string;
  provider_id: number;
  provider_name: string;
  price: string;
}

interface CustomerRow {
  id: string;
  name: string;
  orders_count: number;
}

interface CouponRow {
  code: string;
  type: 'percent' | 'fixed';
  value: string;
  max_discount: string | null;
  min_spend: string;
  scope_kind: string;
  scope_value: string | null;
  starts_on: string;
  ends_on: string;
  usage_limit: number | null;
  used_count: number;
  per_customer_limit: number | null;
  first_order_only: number;
  stackable: number;
  status: 'active' | 'inactive';
}

interface UsageRow {
  coupon_code: string;
  customer_id: string;
  used_count: number;
}

export class CatalogRepository {
  constructor(private db: Database.Database) {}

  getAllServices(): Service[] {
    const rows = this.db
      .prepare('SELECT id, title, type, provider_id, provider_name, price FROM services ORDER BY id')
      .all() as ServiceRow[];

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      providerId: r.provider_id,
      providerName: r.provider_name,
      price: r.price
    }));
  }

  getServiceById(id: string): Service | null {
    const r = this.db
      .prepare('SELECT id, title, type, provider_id, provider_name, price FROM services WHERE id = ?')
      .get(id) as ServiceRow | undefined;

    if (!r) return null;

    return {
      id: r.id,
      title: r.title,
      type: r.type,
      providerId: r.provider_id,
      providerName: r.provider_name,
      price: r.price
    };
  }

  getAllCustomers(): Customer[] {
    const rows = this.db
      .prepare('SELECT id, name, orders_count FROM customers ORDER BY id')
      .all() as CustomerRow[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      ordersCount: r.orders_count
    }));
  }

  getCustomerById(id: string): Customer | null {
    const r = this.db
      .prepare('SELECT id, name, orders_count FROM customers WHERE id = ?')
      .get(id) as CustomerRow | undefined;

    if (!r) return null;

    return {
      id: r.id,
      name: r.name,
      ordersCount: r.orders_count
    };
  }

  getAllCoupons(): Coupon[] {
    const couponRows = this.db
      .prepare(`
        SELECT code, type, value, max_discount, min_spend,
               scope_kind, scope_value, starts_on, ends_on,
               usage_limit, used_count, per_customer_limit,
               first_order_only, stackable, status
        FROM coupons
        ORDER BY code
      `)
      .all() as CouponRow[];

    const usageRows = this.db
      .prepare('SELECT coupon_code, customer_id, used_count FROM coupon_usages')
      .all() as UsageRow[];

    const usageMap = new Map<string, Record<string, number>>();
    for (const u of usageRows) {
      if (!usageMap.has(u.coupon_code)) {
        usageMap.set(u.coupon_code, {});
      }
      usageMap.get(u.coupon_code)![u.customer_id] = u.used_count;
    }

    return couponRows.map((r) => {
      let scope: CouponScope;
      if (r.scope_kind === 'all') {
        scope = { kind: 'all' };
      } else if (r.scope_kind === 'type') {
        scope = { kind: 'type', value: r.scope_value || '' };
      } else if (r.scope_kind === 'provider') {
        scope = { kind: 'provider', value: Number(r.scope_value) };
      } else {
        scope = { kind: 'all' };
      }

      return {
        code: r.code,
        type: r.type,
        value: r.value,
        maxDiscount: r.max_discount,
        minSpend: r.min_spend,
        scope,
        startsOn: r.starts_on,
        endsOn: r.ends_on,
        usageLimit: r.usage_limit,
        usedCount: r.used_count,
        perCustomerLimit: r.per_customer_limit,
        usedBy: usageMap.get(r.code) || {},
        firstOrderOnly: r.first_order_only === 1,
        stackable: r.stackable === 1,
        status: r.status
      };
    });
  }

  getFullCatalog(): CheckoutCatalog {
    return {
      services: this.getAllServices(),
      customers: this.getAllCustomers(),
      coupons: this.getAllCoupons()
    };
  }
}
