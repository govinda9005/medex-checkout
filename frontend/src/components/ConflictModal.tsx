import React from 'react';
import { ConflictErrorData } from '../types/api';

interface ConflictModalProps {
  conflictData: ConflictErrorData;
  onConfirmRevisedOrder: () => void;
  onCancel: () => void;
  isConfirming: boolean;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  conflictData,
  onConfirmRevisedOrder,
  onCancel,
  isConfirming
}) => {
  return (
    <div className="modal-backdrop">
      <div className="modal-dialog conflict-dialog">
        <div className="conflict-icon">⚠️</div>
        <h2>Quote Changed (HTTP 409)</h2>

        <div className="conflict-message-box">
          <p className="conflict-message">{conflictData.message}</p>
        </div>

        <div className="conflict-details">
          <h4>Updated Quote Breakdown</h4>
          <div className="conflict-summary-row">
            <span>Subtotal:</span>
            <span>฿{conflictData.quote.subtotal}</span>
          </div>
          <div className="conflict-summary-row">
            <span>Discounts:</span>
            <span>-฿{conflictData.quote.discountTotal}</span>
          </div>
          <div className="conflict-summary-row">
            <span>VAT (7%):</span>
            <span>+฿{conflictData.quote.vat}</span>
          </div>
          <div className="conflict-summary-row revised-total">
            <span>Revised Total:</span>
            <strong>฿{conflictData.quote.total}</strong>
          </div>
        </div>

        <p className="confirmation-prompt">
          Would you like to confirm and place your order with this revised total?
        </p>

        <div className="modal-actions">
          <button
            type="button"
            className="btn-modal-cancel"
            onClick={onCancel}
            disabled={isConfirming}
          >
            Review Cart
          </button>
          <button
            type="button"
            className="btn-modal-confirm"
            onClick={onConfirmRevisedOrder}
            disabled={isConfirming}
          >
            {isConfirming ? 'Placing Order...' : `Confirm Order (฿${conflictData.quote.total})`}
          </button>
        </div>
      </div>
    </div>
  );
};
