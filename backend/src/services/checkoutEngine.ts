import Decimal from 'decimal.js';
import {
  Service,
  Customer,
  Coupon,
  QuoteRequest,
  QuoteResult,
  LineResult,
  CouponResult,
  CheckoutCatalog
} from '../types/index.js';
import {
  MoneyDecimal,
  parseMoney,
  roundMoney,
  formatMoney,
  formatMoneyWithCommas,
  multiplyMoney,
  addMoney,
  subtractMoney,
  percentOf,
  calculateVat,
  minMoney,
  isZero,
  compareMoney
} from '../utils/money.js';
import {
  getBangkokCalendarDate,
  isBeforeStartsOn,
  isAfterEndsOn
} from '../utils/date.js';

interface LineState {
  serviceId: string;
  service: Service;
  quantity: number;
  originalAmount: Decimal;
  currentAmount: Decimal;
  discounts: Record<string, string>;
}

interface CouponEvaluationItem {
  rawCode: string;
  normalizedCode: string;
  inputIndex: number;
  duplicateOfIndex?: number;
  exceedsLimit?: boolean;
}

export class CheckoutError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'CheckoutError';
  }
}

/**
 * Calculates cart line amounts, coupon eligibility, proportional discounts,
 * VAT, and order totals according to MedEx business rules.
 */
export function calculateQuote(
  catalog: CheckoutCatalog,
  request: QuoteRequest
): QuoteResult {
  const serviceMap = new Map<string, Service>(
    catalog.services.map((s) => [s.id, s])
  );
  const couponMap = new Map<string, Coupon>(
    catalog.coupons.map((c) => [c.code.trim().toUpperCase(), c])
  );
  const customerMap = new Map<string, Customer>(
    catalog.customers.map((c) => [c.id, c])
  );

  // ---------------------------------------------------------
  // 1. Validate and Calculate Cart Lines
  // ---------------------------------------------------------
  if (!request.lines || !Array.isArray(request.lines) || request.lines.length === 0) {
    throw new CheckoutError('Cart cannot be empty', 400);
  }

  const lineStates: LineState[] = request.lines.map((item, index) => {
    if (!item.serviceId) {
      throw new CheckoutError(`Cart line #${index + 1} is missing serviceId`, 400);
    }
    const service = serviceMap.get(item.serviceId);
    if (!service) {
      throw new CheckoutError(`Unknown serviceId: '${item.serviceId}'`, 400);
    }

    if (
      typeof item.quantity !== 'number' ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 20
    ) {
      throw new CheckoutError(
        `Quantity for service '${item.serviceId}' must be a whole number between 1 and 20`,
        400
      );
    }

    const originalAmount = roundMoney(multiplyMoney(service.price, item.quantity));

    return {
      serviceId: item.serviceId,
      service,
      quantity: item.quantity,
      originalAmount,
      currentAmount: new MoneyDecimal(originalAmount),
      discounts: {}
    };
  });

  const subtotal = lineStates.reduce<Decimal>(
    (sum, l) => sum.plus(l.originalAmount),
    new MoneyDecimal(0)
  );

  // ---------------------------------------------------------
  // 2. Coupon Normalization, Deduplication, and Limit Check
  // ---------------------------------------------------------
  const inputCodes = request.couponCodes || [];
  const couponItems: CouponEvaluationItem[] = [];
  const seenCodes = new Set<string>();
  const initialResults = new Map<number, CouponResult>();

  let distinctCodeCount = 0;

  for (let i = 0; i < inputCodes.length; i++) {
    const raw = inputCodes[i];
    const normalized = typeof raw === 'string' ? raw.trim().toUpperCase() : '';

    if (seenCodes.has(normalized)) {
      initialResults.set(i, {
        code: normalized,
        status: 'rejected',
        reason: 'This code is already applied.'
      });
      continue;
    }

    distinctCodeCount++;
    if (distinctCodeCount > 2) {
      initialResults.set(i, {
        code: normalized,
        status: 'rejected',
        reason: 'You can use up to 2 codes per order.'
      });
      continue;
    }

    seenCodes.add(normalized);
    couponItems.push({
      rawCode: raw,
      normalizedCode: normalized,
      inputIndex: i
    });
  }

  // ---------------------------------------------------------
  // 3. Evaluation Order: Non-stackable first, then Stackable
  // ---------------------------------------------------------
  const nonStackableItems: CouponEvaluationItem[] = [];
  const stackableItems: CouponEvaluationItem[] = [];

  for (const item of couponItems) {
    const coupon = couponMap.get(item.normalizedCode);
    if (!coupon || !coupon.stackable) {
      nonStackableItems.push(item);
    } else {
      stackableItems.push(item);
    }
  }

  const evaluationQueue = [...nonStackableItems, ...stackableItems];

  // ---------------------------------------------------------
  // 4. Coupon Validation Pipeline (Checks a through k)
  // ---------------------------------------------------------
  const todayDate = getBangkokCalendarDate(request.at);
  let appliedNonStackableCode: string | null = null;
  const evaluationResults = new Map<number, CouponResult>();

  for (const item of evaluationQueue) {
    const coupon = couponMap.get(item.normalizedCode);

    // Check a: Code exists
    if (!coupon) {
      evaluationResults.set(item.inputIndex, {
        code: item.normalizedCode,
        status: 'rejected',
        reason: "We don't recognise this code."
      });
      continue;
    }

    // Check b: Status is active
    if (coupon.status !== 'active') {
      evaluationResults.set(item.inputIndex, {
        code: item.normalizedCode,
        status: 'rejected',
        reason: 'This code is no longer active.'
      });
      continue;
    }

    // Check c: Today on or after startsOn
    if (isBeforeStartsOn(todayDate, coupon.startsOn)) {
      evaluationResults.set(item.inputIndex, {
        code: item.normalizedCode,
        status: 'rejected',
        reason: `This code starts on ${coupon.startsOn}.`
      });
      continue;
    }

    // Check d: Today on or before endsOn (endsOn is inclusive)
    if (isAfterEndsOn(todayDate, coupon.endsOn)) {
      evaluationResults.set(item.inputIndex, {
        code: item.normalizedCode,
        status: 'rejected',
        reason: `This code expired on ${coupon.endsOn}.`
      });
      continue;
    }

    // Check e: usedCount < usageLimit
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      evaluationResults.set(item.inputIndex, {
        code: item.normalizedCode,
        status: 'rejected',
        reason: 'This code has been fully used.'
      });
      continue;
    }

    // Check f: Logged in customer check
    const requiresCustomer = coupon.perCustomerLimit !== null || coupon.firstOrderOnly;
    if (requiresCustomer && (!request.customerId || request.customerId.trim() === '')) {
      evaluationResults.set(item.inputIndex, {
        code: item.normalizedCode,
        status: 'rejected',
        reason: 'Log in to use this code.'
      });
      continue;
    }

    // Check g: Customer usage count < perCustomerLimit
    if (coupon.perCustomerLimit !== null && request.customerId) {
      const customerUsedCount = coupon.usedBy[request.customerId] || 0;
      if (customerUsedCount >= coupon.perCustomerLimit) {
        evaluationResults.set(item.inputIndex, {
          code: item.normalizedCode,
          status: 'rejected',
          reason: "You've already used this code."
        });
        continue;
      }
    }

    // Check h: firstOrderOnly check
    if (coupon.firstOrderOnly && request.customerId) {
      const customer = customerMap.get(request.customerId);
      const ordersCount = customer ? customer.ordersCount : 0;
      if (ordersCount > 0) {
        evaluationResults.set(item.inputIndex, {
          code: item.normalizedCode,
          status: 'rejected',
          reason: 'This code is only for your first order.'
        });
        continue;
      }
    }

    // Check i: Non-stackable cannot be combined with already applied non-stackable
    if (!coupon.stackable && appliedNonStackableCode !== null) {
      evaluationResults.set(item.inputIndex, {
        code: item.normalizedCode,
        status: 'rejected',
        reason: `This code can't be combined with ${appliedNonStackableCode}.`
      });
      continue;
    }

    // Check j: Scope qualification
    const eligibleLines = lineStates.filter((line) => {
      if (coupon.scope.kind === 'all') return true;
      if (coupon.scope.kind === 'type') return line.service.type === coupon.scope.value;
      if (coupon.scope.kind === 'provider') return line.service.providerId === coupon.scope.value;
      return false;
    });

    if (eligibleLines.length === 0) {
      evaluationResults.set(item.inputIndex, {
        code: item.normalizedCode,
        status: 'rejected',
        reason: 'No items in your cart qualify for this code.'
      });
      continue;
    }

    // Check k: minSpend qualification on eligible lines after previous discounts
    const eligibleAmount = eligibleLines.reduce<Decimal>(
      (sum, l) => sum.plus(l.currentAmount),
      new MoneyDecimal(0)
    );

    const minSpendAmount = parseMoney(coupon.minSpend);
    if (eligibleAmount.lessThan(minSpendAmount)) {
      const missing = minSpendAmount.minus(eligibleAmount);
      evaluationResults.set(item.inputIndex, {
        code: item.normalizedCode,
        status: 'rejected',
        reason: `Spend ฿${formatMoneyWithCommas(missing)} more on eligible items to use this code.`
      });
      continue;
    }

    // ---------------------------------------------------------
    // 5. Calculate and Allocate Discount
    // ---------------------------------------------------------
    let totalDiscount: Decimal;

    if (coupon.type === 'percent') {
      const rawDiscount = percentOf(eligibleAmount, coupon.value);
      if (coupon.maxDiscount !== null) {
        const maxDisc = parseMoney(coupon.maxDiscount);
        totalDiscount = minMoney(rawDiscount, maxDisc);
      } else {
        totalDiscount = rawDiscount;
      }
    } else {
      // Fixed discount cannot exceed eligible amount
      const fixedVal = parseMoney(coupon.value);
      totalDiscount = minMoney(fixedVal, eligibleAmount);
    }

    // Split discount across eligible lines that have remaining amount > 0
    const activeEligibleLines = eligibleLines.filter((l) => l.currentAmount.isPositive());

    if (activeEligibleLines.length > 0 && totalDiscount.isPositive()) {
      interface ShareAllocation {
        line: LineState;
        share: Decimal;
      }

      // Calculate initial proportional shares
      const shares: ShareAllocation[] = activeEligibleLines.map((line) => {
        // round(discount * line.currentAmount / eligibleAmount)
        const unroundedShare = totalDiscount.times(line.currentAmount).dividedBy(eligibleAmount);
        const roundedShare = roundMoney(unroundedShare);
        return {
          line,
          share: roundedShare
        };
      });

      // Sum rounded shares and calculate difference
      const sumShares = shares.reduce<Decimal>(
        (sum, s) => sum.plus(s.share),
        new MoneyDecimal(0)
      );
      const diff = totalDiscount.minus(sumShares);

      // Reconcile difference to the line with largest amount (tie-break: first line)
      if (!diff.isZero()) {
        let maxIndex = 0;
        let maxAmount = activeEligibleLines[0].currentAmount;

        for (let i = 1; i < activeEligibleLines.length; i++) {
          if (activeEligibleLines[i].currentAmount.greaterThan(maxAmount)) {
            maxAmount = activeEligibleLines[i].currentAmount;
            maxIndex = i;
          }
        }

        shares[maxIndex].share = shares[maxIndex].share.plus(diff);
      }

      // Apply shares to line states
      for (const { line, share } of shares) {
        line.discounts[coupon.code] = formatMoney(share);
        line.currentAmount = line.currentAmount.minus(share);
      }
    }

    if (!coupon.stackable) {
      appliedNonStackableCode = coupon.code;
    }

    evaluationResults.set(item.inputIndex, {
      code: item.normalizedCode,
      status: 'applied',
      discount: formatMoney(totalDiscount)
    });
  }

  // ---------------------------------------------------------
  // 6. Assemble Coupon Results in Customer-Entered Order
  // ---------------------------------------------------------
  const finalCoupons: CouponResult[] = [];
  for (let i = 0; i < inputCodes.length; i++) {
    const res = initialResults.get(i) || evaluationResults.get(i);
    if (res) {
      finalCoupons.push(res);
    }
  }

  // ---------------------------------------------------------
  // 7. Assemble Lines and Compute Final Totals
  // ---------------------------------------------------------
  const resultLines: LineResult[] = lineStates.map((l) => ({
    serviceId: l.serviceId,
    quantity: l.quantity,
    amount: formatMoney(l.originalAmount),
    discounts: l.discounts,
    amountAfterDiscounts: formatMoney(l.currentAmount)
  }));

  const totalDiscountAmount = finalCoupons.reduce<Decimal>((sum, c) => {
    if (c.status === 'applied') {
      return sum.plus(parseMoney(c.discount));
    }
    return sum;
  }, new MoneyDecimal(0));

  const netAmount = subtractMoney(subtotal, totalDiscountAmount);
  const vat = calculateVat(netAmount);
  const total = addMoney(netAmount, vat);

  return {
    lines: resultLines,
    coupons: finalCoupons,
    subtotal: formatMoney(subtotal),
    discountTotal: formatMoney(totalDiscountAmount),
    netAmount: formatMoney(netAmount),
    vat: formatMoney(vat),
    total: formatMoney(total)
  };
}
