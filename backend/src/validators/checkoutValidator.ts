import { z } from 'zod';

export const cartLineSchema = z.object({
  serviceId: z.string().min(1, 'serviceId is required'),
  quantity: z
    .number({ required_error: 'quantity is required' })
    .int('quantity must be a whole number')
    .min(1, 'quantity must be between 1 and 20')
    .max(20, 'quantity must be between 1 and 20')
});

export const quoteRequestSchema = z.object({
  lines: z
    .array(cartLineSchema)
    .min(1, 'Cart cannot be empty'),
  couponCodes: z
    .array(z.string())
    .optional()
    .default([]),
  customerId: z
    .string()
    .nullable()
    .optional()
    .default(null),
  at: z.string().optional(),
  expectedTotal: z.string().optional()
});

export const orderRequestSchema = quoteRequestSchema.extend({
  expectedAppliedCodes: z.array(z.string()).optional()
});

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;
export type OrderRequestInput = z.infer<typeof orderRequestSchema>;
