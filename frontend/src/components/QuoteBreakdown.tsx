import React from 'react';
import { QuoteResult, Service } from '../types/api';

interface QuoteBreakdownProps {
  quote: QuoteResult | null;
  servicesMap: Map<string, Service>;
  isLoading: boolean;
  isOrdering: boolean;
  onPlaceOrder: () => void;
  disabled: boolean;
}

export const QuoteBreakdown: React.FC<QuoteBreakdownProps> = ({
  quote,
  servicesMap,
  isLoading,
  isOrdering,
  onPlaceOrder,
  disabled
}) => {
  if (!quote) {
    return (
      <div className="breakdown-card">
        <h3>Order Summary</h3>
        <p className="summary-empty">Add items to your cart to see live totals.</p>
      </div>
    );
  }

  const formatBaht = (val: string) => `฿${val}`;

  return (
    <div className={`breakdown-card ${isLoading ? 'is-loading' : ''}`}>
      <div className="breakdown-header">
        <h3>Order Summary</h3>
        {isLoading && <span className="loading-badge">Calculating...</span>}
      </div>

      {/* Per-line breakdown */}
      <div className="line-breakdown-list">
        {quote.lines.map((line) => {
          const service = servicesMap.get(line.serviceId);
          const hasDiscounts = Object.keys(line.discounts).length > 0;

          return (
            <div key={line.serviceId} className="breakdown-line-item">
              <div className="line-main">
                <span className="line-name">
                  {service?.title || line.serviceId} &times; {line.quantity}
                </span>
                <span className="line-amount">{formatBaht(line.amount)}</span>
              </div>

              {/* Individual coupon discounts on this line */}
              {hasDiscounts && (
                <div className="line-discounts-details">
                  {Object.entries(line.discounts).map(([couponCode, discountAmount]) => (
                    <div key={couponCode} className="line-discount-subrow">
                      <span className="discount-label">↳ {couponCode}</span>
                      <span className="discount-amount">-{formatBaht(discountAmount)}</span>
                    </div>
                  ))}
                  <div className="line-net-subrow">
                    <span>Amount after discounts:</span>
                    <strong>{formatBaht(line.amountAfterDiscounts)}</strong>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="breakdown-divider" />

      {/* Totals Section */}
      <div className="totals-table">
        <div className="total-row">
          <span>Subtotal</span>
          <span>{formatBaht(quote.subtotal)}</span>
        </div>

        <div className="total-row discount-row">
          <span>Total Discounts</span>
          <span>-{formatBaht(quote.discountTotal)}</span>
        </div>

        <div className="total-row">
          <span>Net Amount</span>
          <span>{formatBaht(quote.netAmount)}</span>
        </div>

        <div className="total-row vat-row">
          <span>VAT (7%)</span>
          <span>+{formatBaht(quote.vat)}</span>
        </div>

        <div className="breakdown-divider" />

        <div className="total-row final-total-row">
          <span>Final Total</span>
          <span className="final-total-amount">{formatBaht(quote.total)}</span>
        </div>
      </div>

      <button
        type="button"
        className="btn-place-order"
        disabled={disabled || isOrdering || isLoading}
        onClick={onPlaceOrder}
      >
        {isOrdering ? 'Processing Order...' : `Place Order (${formatBaht(quote.total)})`}
      </button>
    </div>
  );
};
