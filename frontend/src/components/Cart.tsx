import React from 'react';
import { CartItem, Service } from '../types/api';

interface CartProps {
  items: CartItem[];
  servicesMap: Map<string, Service>;
  onUpdateQuantity: (serviceId: string, quantity: number) => void;
  onRemoveItem: (serviceId: string) => void;
  onClearCart: () => void;
}

export const Cart: React.FC<CartProps> = ({
  items,
  servicesMap,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart
}) => {
  if (items.length === 0) {
    return (
      <div className="cart-card empty-cart">
        <div className="empty-cart-icon">🛒</div>
        <h3>Your Cart is Empty</h3>
        <p>Select medical services from the catalog above to build your order.</p>
      </div>
    );
  }

  return (
    <div className="cart-card">
      <div className="cart-header">
        <h3>Cart Items ({items.length})</h3>
        <button type="button" className="btn-text-danger" onClick={onClearCart}>
          Clear All
        </button>
      </div>

      <div className="cart-list">
        {items.map((item) => {
          const service = servicesMap.get(item.serviceId);
          if (!service) return null;

          return (
            <div key={item.serviceId} className="cart-item">
              <div className="item-info">
                <span className="item-title">{service.title}</span>
                <span className="item-meta">
                  {service.providerName} &bull; ฿{service.price} each
                </span>
              </div>

              <div className="item-actions">
                <div className="qty-control">
                  <button
                    type="button"
                    className="qty-btn"
                    disabled={item.quantity <= 1}
                    onClick={() => onUpdateQuantity(item.serviceId, item.quantity - 1)}
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <span className="qty-display">{item.quantity}</span>
                  <button
                    type="button"
                    className="qty-btn"
                    disabled={item.quantity >= 20}
                    onClick={() => onUpdateQuantity(item.serviceId, item.quantity + 1)}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  className="btn-remove"
                  onClick={() => onRemoveItem(item.serviceId)}
                  title="Remove service from cart"
                >
                  &times;
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
