import React from 'react';
import { Customer } from '../types/api';

interface HeaderProps {
  customers: Customer[];
  selectedCustomerId: string | null;
  onSelectCustomer: (id: string | null) => void;
  useFixedDate: boolean;
  onToggleFixedDate: (val: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  useFixedDate,
  onToggleFixedDate
}) => {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="logo-icon">M</div>
        <div>
          <h1>MedEx Checkout</h1>
          <p className="subtitle">Coupon & Checkout Calculator</p>
        </div>
      </div>

      <div className="header-controls">
        <div className="control-group">
          <label htmlFor="customer-select">Customer:</label>
          <select
            id="customer-select"
            value={selectedCustomerId ?? ''}
            onChange={(e) => onSelectCustomer(e.target.value === '' ? null : e.target.value)}
            className="select-input"
          >
            <option value="">Guest (Logged out)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id}) — {c.ordersCount} previous {c.ordersCount === 1 ? 'order' : 'orders'}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group date-toggle">
          <label className="checkbox-label" title="Controls whether to use 2026-11-02 from assessment fixture">
            <input
              type="checkbox"
              checked={useFixedDate}
              onChange={(e) => onToggleFixedDate(e.target.checked)}
            />
            <span>Test Date: <code>2026-11-02</code></span>
          </label>
        </div>
      </div>
    </header>
  );
};
