import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Service,
  Customer,
  CartItem,
  QuoteResult,
  PlacedOrder,
  ConflictErrorData
} from './types/api';
import {
  fetchServices,
  fetchCustomers,
  fetchQuote,
  placeOrder,
  ConflictApiError
} from './services/api';
import { Header } from './components/Header';
import { ServiceCatalog } from './components/ServiceCatalog';
import { Cart } from './components/Cart';
import { CouponInput } from './components/CouponInput';
import { QuoteBreakdown } from './components/QuoteBreakdown';
import { ConflictModal } from './components/ConflictModal';
import { OrderConfirmation } from './components/OrderConfirmation';

const FIXED_ASSESSMENT_DATE = '2026-11-02T10:00:00+07:00';

export default function App() {
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>('C1');
  const [useFixedDate, setUseFixedDate] = useState<boolean>(true);

  // Cart & Coupon State
  const [cart, setCart] = useState<CartItem[]>([
    { serviceId: 'S1', quantity: 1 }
  ]);
  const [couponCodes, setCouponCodes] = useState<string[]>(['WELCOME10']);

  // Quote & Order State
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);
  const [isLoadingQuote, setIsLoadingQuote] = useState<boolean>(false);
  const [isOrdering, setIsOrdering] = useState<boolean>(false);
  const [orderResult, setOrderResult] = useState<PlacedOrder | null>(null);
  const [conflictData, setConflictData] = useState<ConflictErrorData | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Stale request sequencing ref
  const quoteSeqRef = useRef<number>(0);

  // Load initial catalog & customers
  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoadingCatalog(true);
        setGlobalError(null);
        const [servicesData, customersData] = await Promise.all([
          fetchServices(),
          fetchCustomers()
        ]);
        setServices(servicesData);
        setCustomers(customersData);
      } catch (err: any) {
        setGlobalError(err.message || 'Failed to connect to backend server');
      } finally {
        setIsLoadingCatalog(false);
      }
    }
    loadInitialData();
  }, []);

  const servicesMap = useMemo(() => {
    return new Map<string, Service>(services.map((s) => [s.id, s]));
  }, [services]);

  const cartServiceIds = useMemo(() => {
    return new Set<string>(cart.map((c) => c.serviceId));
  }, [cart]);

  // Recalculate quote whenever cart, coupons, customer, or date changes
  useEffect(() => {
    if (cart.length === 0) {
      setQuote(null);
      return;
    }

    const currentSeq = ++quoteSeqRef.current;
    setIsLoadingQuote(true);

    const at = useFixedDate ? FIXED_ASSESSMENT_DATE : undefined;

    fetchQuote({
      lines: cart,
      couponCodes,
      customerId: selectedCustomerId,
      at
    })
      .then((newQuote) => {
        // Discard out-of-order stale responses
        if (currentSeq === quoteSeqRef.current) {
          setQuote(newQuote);
          setGlobalError(null);
        }
      })
      .catch((err) => {
        if (currentSeq === quoteSeqRef.current) {
          // If quote calculation fails
          setQuote(null);
          setGlobalError(err.message);
        }
      })
      .finally(() => {
        if (currentSeq === quoteSeqRef.current) {
          setIsLoadingQuote(false);
        }
      });
  }, [cart, couponCodes, selectedCustomerId, useFixedDate]);

  // Cart operations
  const handleAddToCart = (serviceId: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.serviceId === serviceId);
      if (existing) {
        if (existing.quantity >= 20) return prev;
        return prev.map((item) =>
          item.serviceId === serviceId
            ? { ...item, quantity: Math.min(20, item.quantity + 1) }
            : item
        );
      }
      return [...prev, { serviceId, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (serviceId: string, quantity: number) => {
    const clamped = Math.max(1, Math.min(20, Math.floor(quantity)));
    setCart((prev) =>
      prev.map((item) =>
        item.serviceId === serviceId ? { ...item, quantity: clamped } : item
      )
    );
  };

  const handleRemoveCartItem = (serviceId: string) => {
    setCart((prev) => prev.filter((item) => item.serviceId !== serviceId));
  };

  const handleClearCart = () => {
    setCart([]);
    setCouponCodes([]);
    setQuote(null);
  };

  // Coupon operations
  const handleAddCoupon = (code: string) => {
    setCouponCodes((prev) => [...prev, code]);
  };

  const handleRemoveCoupon = (index: number) => {
    setCouponCodes((prev) => prev.filter((_, i) => i !== index));
  };

  // Order Placement
  const handlePlaceOrder = async (confirmedExpectedTotal?: string) => {
    if (cart.length === 0 || !quote) return;

    try {
      setIsOrdering(true);
      setGlobalError(null);

      const at = useFixedDate ? FIXED_ASSESSMENT_DATE : undefined;
      const expectedTotal = confirmedExpectedTotal || quote.total;

      const order = await placeOrder({
        lines: cart,
        couponCodes,
        customerId: selectedCustomerId,
        at,
        expectedTotal
      });

      setOrderResult(order);
      setConflictData(null);
      // Refresh customer list to update ordersCount badge
      fetchCustomers().then(setCustomers).catch(() => {});
    } catch (err: any) {
      if (err instanceof ConflictApiError) {
        setConflictData(err.conflictData);
        // Also update local quote to reflect backend recalculation
        setQuote(err.conflictData.quote);
      } else {
        setGlobalError(err.message || 'Failed to place order');
      }
    } finally {
      setIsOrdering(false);
    }
  };

  const handleNewOrder = () => {
    setOrderResult(null);
    setCart([{ serviceId: 'S1', quantity: 1 }]);
    setCouponCodes([]);
    setConflictData(null);
  };

  if (isLoadingCatalog) {
    return (
      <div className="app-loading-screen">
        <div className="spinner" />
        <h2>Loading MedEx Checkout...</h2>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header
        customers={customers}
        selectedCustomerId={selectedCustomerId}
        onSelectCustomer={setSelectedCustomerId}
        useFixedDate={useFixedDate}
        onToggleFixedDate={setUseFixedDate}
      />

      {globalError && (
        <div className="global-error-banner">
          <span>⚠️ {globalError}</span>
          <button type="button" onClick={() => setGlobalError(null)}>Dismiss</button>
        </div>
      )}

      {orderResult ? (
        <OrderConfirmation
          order={orderResult}
          servicesMap={servicesMap}
          onNewOrder={handleNewOrder}
        />
      ) : (
        <main className="main-layout">
          {/* Left Column: Catalog & Cart */}
          <div className="left-column">
            <ServiceCatalog
              services={services}
              cartServiceIds={cartServiceIds}
              onAddToCart={handleAddToCart}
            />

            <Cart
              items={cart}
              servicesMap={servicesMap}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveCartItem}
              onClearCart={handleClearCart}
            />
          </div>

          {/* Right Column: Coupons & Quote Breakdown */}
          <div className="right-column">
            <CouponInput
              couponResults={quote?.coupons || []}
              onAddCode={handleAddCoupon}
              onRemoveCode={handleRemoveCoupon}
            />

            <QuoteBreakdown
              quote={quote}
              servicesMap={servicesMap}
              isLoading={isLoadingQuote}
              isOrdering={isOrdering}
              onPlaceOrder={() => handlePlaceOrder()}
              disabled={cart.length === 0}
            />
          </div>
        </main>
      )}

      {/* 409 Conflict Confirmation Dialog */}
      {conflictData && (
        <ConflictModal
          conflictData={conflictData}
          onConfirmRevisedOrder={() => handlePlaceOrder(conflictData.quote.total)}
          onCancel={() => setConflictData(null)}
          isConfirming={isOrdering}
        />
      )}
    </div>
  );
}
