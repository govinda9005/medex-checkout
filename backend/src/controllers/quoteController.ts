import { Request, Response } from 'express';
import { CatalogRepository } from '../repositories/catalogRepository.js';
import { calculateQuote, CheckoutError } from '../services/checkoutEngine.js';
import { quoteRequestSchema } from '../validators/checkoutValidator.js';
import { ZodError } from 'zod';

export function createQuoteController(catalogRepo: CatalogRepository) {
  return {
    postQuote: (req: Request, res: Response) => {
      try {
        const validated = quoteRequestSchema.parse(req.body);
        const catalog = catalogRepo.getFullCatalog();
        const quote = calculateQuote(catalog, validated);

        res.status(200).json(quote);
      } catch (err: any) {
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
          error: 'Internal calculation error',
          message: err.message
        });
      }
    }
  };
}
