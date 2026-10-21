export interface Service {
  id: string;
  title: string;
  type: string;
  providerId: number;
  providerName: string;
  price: string;
}

export interface Customer {
  id: string;
  name: string;
  ordersCount: number;
}

export type CouponScope =
  | { kind: 'all' }
  | { kind: 'type'; value: string }
  | { kind: 'provider'; value: number };

export interface Coupon {
  code: string;
  type: 'percent' | 'fixed';
  value: string;
  maxDiscount: string | null;
  minSpend: string;
  scope: CouponScope;
  startsOn: string;
  endsOn: string;
  usageLimit: number | null;
  usedCount: number;
  perCustomerLimit: number | null;
  usedBy: Record<string, number>;
  firstOrderOnly: boolean;
  stackable: boolean;
  status: 'active' | 'inactive';
}

export interface CartLineInput {
  serviceId: string;
  quantity: number;
}

export interface QuoteRequest {
  lines: CartLineInput[];
  couponCodes: string[];
  customerId: string | null;
  at?: string;
  // Optional client context for stale quote detection during order placement
  expectedTotal?: string;
}

export interface LineResult {
  serviceId: string;
  quantity: number;
  amount: string;
  discounts: Record<string, string>;
  amountAfterDiscounts: string;
}

export type CouponResult =
  | {
      code: string;
      status: 'applied';
      discount: string;
    }
  | {
      code: string;
      status: 'rejected';
      reason: string;
    };

export interface QuoteResult {
  lines: LineResult[];
  coupons: CouponResult[];
  subtotal: string;
  discountTotal: string;
  netAmount: string;
  vat: string;
  total: string;
}

export interface CheckoutCatalog {
  services: Service[];
  coupons: Coupon[];
  customers: Customer[];
}
