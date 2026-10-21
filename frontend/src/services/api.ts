import {
  Service,
  Customer,
  QuoteRequest,
  QuoteResult,
  PlacedOrder,
  ConflictErrorData
} from '../types/api';

export class ApiError extends Error {
  statusCode: number;
  data: any;

  constructor(message: string, statusCode: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

export class ConflictApiError extends ApiError {
  conflictData: ConflictErrorData;

  constructor(conflictData: ConflictErrorData) {
    super(conflictData.message, 409, conflictData);
    this.name = 'ConflictApiError';
    this.conflictData = conflictData;
  }
}

export async function fetchServices(): Promise<Service[]> {
  const res = await fetch('/api/services');
  if (!res.ok) {
    throw new ApiError('Failed to fetch medical services', res.status);
  }
  return res.json();
}

export async function fetchCustomers(): Promise<Customer[]> {
  const res = await fetch('/api/customers');
  if (!res.ok) {
    throw new ApiError('Failed to fetch customers', res.status);
  }
  return res.json();
}

export async function fetchQuote(
  request: QuoteRequest,
  signal?: AbortSignal
): Promise<QuoteResult> {
  const res = await fetch('/api/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal
  });

  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || 'Failed to calculate quote', res.status, data);
  }
  return data as QuoteResult;
}

export async function placeOrder(request: QuoteRequest): Promise<PlacedOrder> {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  const data = await res.json();

  if (res.status === 409) {
    throw new ConflictApiError(data as ConflictErrorData);
  }

  if (!res.ok) {
    throw new ApiError(data.error || 'Failed to place order', res.status, data);
  }

  return data as PlacedOrder;
}
