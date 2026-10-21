import { useState } from 'react';
import { CouponResult } from '../types/api';

interface CouponInputProps {
  couponResults: CouponResult[];
  onAddCode: (code: string) => void;
  onRemoveCode: (index: number) => void;
}

const COMMON_CODES = [
  'WELCOME10',
  'LAB15',
  'RIVER200',
  'SPA50',
  'LASTONE',
  'ONCE',
  'FLASH25',
  'NEWYEAR'
];

export const CouponInput = ({
  couponResults,
  onAddCode,
  onRemoveCode
}: CouponInputProps) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    onAddCode(trimmed);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="coupon-section">
      <h3>Coupons & Promotions</h3>

      <form className="coupon-input-bar" onSubmit={handleSubmit}>
        <input
          type="text"
          className="coupon-text-input"
          placeholder="Enter coupon code (e.g. WELCOME10)"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          className="btn-apply-coupon"
          disabled={!inputValue.trim()}
        >
          Apply
        </button>
      </form>

      {/* Quick Test Chips */}
      <div className="quick-codes">
        <span className="quick-label">Quick Test:</span>
        <div className="quick-pills">
          {COMMON_CODES.map((c) => (
            <button
              key={c}
              type="button"
              className="quick-pill"
              onClick={() => onAddCode(c)}
              title={`Test code ${c}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Applied / Rejected Feedback Chips */}
      {couponResults.length > 0 && (
        <div className="coupon-results-list">
          {couponResults.map((result, idx) => {
            const isApplied = result.status === 'applied';

            return (
              <div
                key={`${result.code}-${idx}`}
                className={`coupon-feedback-chip ${isApplied ? 'applied' : 'rejected'}`}
              >
                <div className="chip-main">
                  <div className="chip-badge">
                    <span className="chip-icon">{isApplied ? '✓' : '⚠'}</span>
                    <strong className="chip-code">{result.code}</strong>
                    {isApplied && (
                      <span className="chip-discount">-฿{result.discount}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-chip-remove"
                    onClick={() => onRemoveCode(idx)}
                    title={`Remove ${result.code}`}
                    aria-label={`Remove ${result.code}`}
                  >
                    &times;
                  </button>
                </div>

                {!isApplied && (
                  <p className="chip-reason">{result.reason}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
