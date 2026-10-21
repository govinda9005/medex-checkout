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

export interface CartItem {
  serviceId: string;
  quantity: number;
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

export interface QuoteRequest {
  lines: CartItem[];
  couponCodes: string[];
  customerId: string | null;
  at?: string;
  expectedTotal?: string;
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
  lines: LineResult[];
  coupons: CouponResult[];
  createdAt: string;
}

export interface ConflictErrorData {
  error: string;
  message: string;
  quote: QuoteResult;
  changedCoupons: string[];
}
