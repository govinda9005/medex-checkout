import React from 'react';
import { PlacedOrder, Service } from '../types/api';

interface OrderConfirmationProps {
  order: PlacedOrder;
  servicesMap: Map<string, Service>;
  onNewOrder: () => void;
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({
  order,
  servicesMap,
  onNewOrder
}) => {
  return (
    <div className="confirmation-card">
      <div className="confirmation-header">
        <div className="success-icon">✓</div>
        <h2>Order Confirmed!</h2>
        <p className="order-id">Order ID: <code>{order.orderId}</code></p>
        <span className="order-timestamp">
          Placed on: {new Date(order.createdAt).toLocaleString()}
        </span>
      </div>

      <div className="confirmation-body">
        <h4>Purchased Services</h4>
        <div className="confirmed-items-list">
          {order.lines.map((line) => {
            const service = servicesMap.get(line.serviceId);
            return (
              <div key={line.serviceId} className="confirmed-item">
                <div className="item-info">
                  <strong>{service?.title || line.serviceId}</strong>
                  <span className="item-qty">&times; {line.quantity}</span>
                </div>
                <div className="item-pricing">
                  {Object.keys(line.discounts).length > 0 && (
                    <span className="orig-price">฿{line.amount}</span>
                  )}
                  <span className="final-price">฿{line.amountAfterDiscounts}</span>
                </div>
              </div>
            );
          })}
        </div>

        {order.coupons.some((c) => c.status === 'applied') && (
          <div className="applied-coupons-summary">
            <h4>Applied Coupons</h4>
            {order.coupons
              .filter((c) => c.status === 'applied')
              .map((c) => (
                <div key={c.code} className="applied-coupon-row">
                  <span className="coupon-tag">🏷 {c.code}</span>
                  <span className="coupon-saving">-฿{c.discount}</span>
                </div>
              ))}
          </div>
        )}

        <div className="confirmation-totals">
          <div className="tot-row">
            <span>Subtotal</span>
            <span>฿{order.subtotal}</span>
          </div>
          <div className="tot-row discount">
            <span>Total Discounts</span>
            <span>-฿{order.discountTotal}</span>
          </div>
          <div className="tot-row">
            <span>Net Amount</span>
            <span>฿{order.netAmount}</span>
          </div>
          <div className="tot-row">
            <span>VAT (7%)</span>
            <span>+฿{order.vat}</span>
          </div>
          <div className="tot-row grand-total">
            <span>Total Paid</span>
            <span>฿{order.total}</span>
          </div>
        </div>
      </div>

      <div className="confirmation-footer">
        <button type="button" className="btn-primary" onClick={onNewOrder}>
          Start Another Order
        </button>
      </div>
    </div>
  );
};
