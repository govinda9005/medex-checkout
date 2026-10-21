import { Request, Response } from 'express';
import { OrderService, StaleQuoteConflictError } from '../services/orderService.js';
import { CheckoutError } from '../services/checkoutEngine.js';
import { orderRequestSchema } from '../validators/checkoutValidator.js';
import { ZodError } from 'zod';

export function createOrderController(orderService: OrderService) {
  return {
    postOrder: (req: Request, res: Response) => {
      try {
        const validated = orderRequestSchema.parse(req.body);
        const order = orderService.placeOrder(validated);

        res.status(201).json(order);
      } catch (err: any) {
        if (err instanceof StaleQuoteConflictError) {
          res.status(409).json({
            error: 'Quote Conflict',
            message: err.message,
            quote: err.updatedQuote,
            changedCoupons: err.changedCoupons
          });
          return;
        }

        if (err instanceof ZodError) {
          res.status(400).json({
            error: 'Validation Error',
            details: err.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message
            }))
          });
          return;
        }

        if (err instanceof CheckoutError) {
          res.status(err.statusCode).json({
            error: err.message
          });
          return;
        }

        res.status(500).json({
          error: 'Order processing error',
          message: err.message
        });
      }
    }
  };
}
