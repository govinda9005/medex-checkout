import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchServices,
  fetchCustomers,
  fetchQuote,
  placeOrder,
  ApiError,
  ConflictApiError
} from './api';

describe('Frontend API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchServices returns services on HTTP 200', async () => {
    const mockServices = [
      { id: 'S1', title: 'Thyroid Function Test', type: 'lab_test', providerId: 48, providerName: 'Hospital', price: '1200.00' }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockServices
    });

    const result = await fetchServices();
    expect(result).toEqual(mockServices);
    expect(global.fetch).toHaveBeenCalledWith('/api/services');
  });

  it('fetchQuote handles successful quote response', async () => {
    const mockQuote = {
      lines: [],
      coupons: [],
      subtotal: '1200.00',
      discountTotal: '0.00',
      netAmount: '1200.00',
      vat: '84.00',
      total: '1284.00'
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockQuote
    });

    const result = await fetchQuote({ lines: [{ serviceId: 'S1', quantity: 1 }], couponCodes: [], customerId: null });
    expect(result).toEqual(mockQuote);
  });

  it('placeOrder throws ConflictApiError on HTTP 409', async () => {
    const conflictPayload = {
      error: 'Quote Conflict',
      message: 'LASTONE is no longer available; your total is now ฿1,284.00',
      quote: { total: '1284.00' },
      changedCoupons: ['LASTONE']
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => conflictPayload
    });

    await expect(
      placeOrder({ lines: [{ serviceId: 'S1', quantity: 1 }], couponCodes: ['LASTONE'], customerId: null })
    ).rejects.toThrow(ConflictApiError);
  });

  it('fetchServices throws ApiError on non-200 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' })
    });

    await expect(fetchServices()).rejects.toThrow(ApiError);
  });
});
