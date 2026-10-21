# MedEx Coupon & Checkout Calculator

A production-grade, highly reliable checkout calculation engine and responsive React web application designed for the **MedEx Healthcare Marketplace** (serving Thailand, Nepal, and India).

This solution implements exact financial calculations to the satang, multi-coupon evaluation with precedence rules, proportional multi-line discount allocation, and concurrency-safe transactional order placement with SQLite.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Key Features](#2-key-features)
3. [Technology Stack](#3-technology-stack)
4. [Prerequisites](#4-prerequisites)
5. [Installation Steps](#5-installation-steps)
6. [How to Run the Backend](#6-how-to-run-the-backend)
7. [How to Run the Frontend](#7-how-to-run-the-frontend)
8. [How to Run Automated Tests](#8-how-to-run-automated-tests)
9. [Required API Endpoints & Contracts](#9-required-api-endpoints--contracts)
10. [Checkout Calculation Approach](#10-checkout-calculation-approach)
11. [Monetary Precision & Round-Half-Up Strategy](#11-monetary-precision--round-half-up-strategy)
12. [Coupon Evaluation & Stacking Rules](#12-coupon-evaluation--stacking-rules)
13. [Discount Allocation Strategy](#13-discount-allocation-strategy)
14. [Database Design & Persistence](#14-database-design--persistence)
15. [How Concurrent Coupon Redemption is Handled](#15-how-concurrent-coupon-redemption-is-handled)
16. [Known Limitations](#16-known-limitations)
17. [What I Would Improve with More Time](#17-what-i-would-improve-with-more-time)
18. [AI Usage Disclosure](#18-ai-usage-disclosure)

---

## 1. Project Overview

MedEx is an online healthcare marketplace where patients across Thailand, Nepal, and India book diagnostic lab tests, executive wellness packages, and clinic treatments. During checkout, customers select medical services and apply promotional coupon codes.

This project delivers:
- An authoritative, framework-agnostic **Calculation Engine** that computes exact item totals, applies tiered validation checks, splits coupon discounts proportionally across qualifying cart lines, and computes 7% Thai Value Added Tax (VAT).
- A **Persistent Backend API** (Express + SQLite) that executes atomic order placement and prevents race conditions when redeeming limited coupons.
- A **Responsive React 18 Application** (Vite + TypeScript) supporting viewports from desktop down to 375px mobile screens, featuring request sequencing to prevent asynchronous UI race conditions and confirmation dialogues for quote conflicts (HTTP 409).

---

## 2. Key Features

- **Satang-Accurate Financial Engine:** Implemented with `decimal.js` configured with `Decimal.ROUND_HALF_UP` and 28-digit precision, completely eliminating JavaScript floating-point errors (e.g. `0.1 + 0.2 !== 0.3`).
- **Standardized Coupon Normalization:** Trims whitespace and normalizes codes to uppercase (e.g., `" lab15 "` becomes `LAB15`).
- **Deduplication & 2-Code Limit:** Rejects duplicate codes (`"This code is already applied."`) and caps distinct codes at two per order (`"You can use up to 2 codes per order."`).
- **Evaluation Priority vs. Reporting Order:** Evaluates non-stackable coupons before stackable coupons, while reporting results back in the exact order entered by the customer.
- **11-Stage Sequential Validation Pipeline:** Strictly evaluates Checks a through k in order, outputting verbatim rejection messages.
- **Sequential Line Discounting:** When multiple coupons apply, subsequent coupons compute eligible spend from line amounts *after* previous discounts have been subtracted.
- **Largest-Line Remainder Allocation:** Reconciles 1-satang rounding differences caused by fractional line shares to the qualifying item with the largest amount (ties broken by line order).
- **Restart-Proof SQLite Storage:** Seeded from `data/checkout.json` once; preserves all redemption counts, customer order counts, and order records across server restarts.
- **Atomic Concurrency Protection:** Uses SQLite `IMMEDIATE` transactions combined with atomic conditional updates (`UPDATE ... WHERE used_count < usage_limit`) to guarantee that coupons with 1 redemption remaining (such as `LASTONE`) cannot be double-redeemed by simultaneous requests.
- **HTTP 409 Conflict Handling:** If a coupon expires or reaches capacity between quote and purchase, the backend rejects with HTTP 409 and returns the revised quote for explicit customer confirmation.
- **Asynchronous Request Sequencing:** The React frontend uses sequence refs to drop stale out-of-order quote responses during rapid quantity changes.

---

## 3. Technology Stack

### Backend
- **Runtime:** Node.js (v22+)
- **Language:** TypeScript (ES2022, NodeNext resolution, Strict mode)
- **Framework:** Express 4
- **Database:** SQLite via `better-sqlite3` (with WAL mode enabled)
- **Validation:** Zod
- **Arithmetic Precision:** `decimal.js` (isolated `Decimal.clone()` with `ROUND_HALF_UP`)
- **Testing:** Vitest & Supertest

### Frontend
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite 6
- **Styling:** Vanilla CSS with custom tokens (optimized for mobile >= 375px)

---

## 4. Prerequisites

- **Node.js:** v20.0.0 or higher (v22 recommended)
- **npm:** v10.0.0 or higher
- **Git:** v2.30+

---

## 5. Installation Steps

Clone the repository and install dependencies for both the backend and frontend:

```bash
# Clone the repository
git clone <repository-url>
cd medex-checkout

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root directory
cd ..
```

Alternatively, you can run `npm install` within each folder directly.

---

## 6. How to Run the Backend

The backend listens on **port 3001** by default.

```bash
# From root directory:
npm run dev:backend

# Or directly from backend/:
cd backend
npm run dev
```

You can verify the backend is running with a quick health check:
```bash
curl http://localhost:3001/health
# {"status":"ok","service":"medex-checkout-backend"}
```

---

## 7. How to Run the Frontend

The frontend dev server runs on **port 3000** and reverse-proxies `/api` requests to `http://localhost:3001`.

```bash
# From root directory:
npm run dev:frontend

# Or directly from frontend/:
cd frontend
npm run dev
```

Open your browser to:
[http://localhost:3000](http://localhost:3000)

---

## 8. How to Run Automated Tests

The automated test suite contains **65 comprehensive unit, integration, and acceptance tests** across 6 test suites, verifying:
1. Precision rounding, satang accuracy, and anti-float drift.
2. Bangkok calendar date interpretation across UTC boundaries.
3. Every check in the 11-stage coupon pipeline (Checks a through k).
4. All 3 mandatory acceptance examples from `data/checkout.json`.
5. Atomic conditional updates and race-condition safety for `LASTONE`.
6. Stale quote conflict handling (HTTP 409) and customer revision confirmation.
7. End-to-end HTTP endpoints with Zod request validation.

Run all tests from the root directory:
```bash
npm test
```

Or from the `backend/` directory:
```bash
cd backend
npm test
```

---

## 9. Required API Endpoints & Contracts

### 1. `GET /api/services`
Returns the authoritative medical services available for purchase.

**Response (HTTP 200):**
```json
[
  {
    "id": "S1",
    "title": "Thyroid Function Test",
    "type": "lab_test",
    "providerId": 48,
    "providerName": "Riverside International Hospital",
    "price": "1200.00"
  },
  ...
]
```

### 2. `POST /api/quote`
Calculates line amounts, coupon discounts, VAT, and final totals. Does not mutate database state or consume coupons.

**Request Body:**
```json
{
  "lines": [
    { "serviceId": "S1", "quantity": 1 },
    { "serviceId": "S2", "quantity": 1 }
  ],
  "couponCodes": ["WELCOME10"],
  "customerId": "C1",
  "at": "2026-11-02T10:00:00+07:00"
}
```

**Response (HTTP 200):**
```json
{
  "lines": [
    {
      "serviceId": "S1",
      "quantity": 1,
      "amount": "1200.00",
      "discounts": { "WELCOME10": "77.41" },
      "amountAfterDiscounts": "1122.59"
    },
    {
      "serviceId": "S2",
      "quantity": 1,
      "amount": "3450.50",
      "discounts": { "WELCOME10": "222.59" },
      "amountAfterDiscounts": "3227.91"
    }
  ],
  "coupons": [
    {
      "code": "WELCOME10",
      "status": "applied",
      "discount": "300.00"
    }
  ],
  "subtotal": "4650.50",
  "discountTotal": "300.00",
  "netAmount": "4350.50",
  "vat": "304.54",
  "total": "4655.04"
}
```

### 3. `POST /api/orders`
Places an order, executes atomic coupon redemptions, updates customer order counts, and persists order details.

- **Success (HTTP 201 Created):**
  Returns `{ "orderId": "ord_...", "status": "confirmed", "total": "4655.04", ... }`.
- **Conflict (HTTP 409 Conflict):**
  Returned if a previously applicable coupon is no longer applicable (e.g. usage limit reached or customer has previous orders), returning the newly recalculated quote:
  ```json
  {
    "error": "Quote Conflict",
    "message": "LASTONE is no longer available; your total is now ฿1,284.00",
    "quote": { ... },
    "changedCoupons": ["LASTONE"]
  }
  ```
  The customer confirms the revision by resubmitting with `expectedTotal: quote.total`.

---

## 10. Checkout Calculation Approach

The calculation logic is isolated in a pure, deterministic engine (`checkoutEngine.ts`):

```text
[Input Cart & Codes]
       │
       ▼
Phase 1: Line Amounts & Subtotal (price * quantity)
       │
       ▼
Phase 2: Coupon Normalization, Deduplication, & 2-Code Limit
       │
       ▼
Phase 3: Sorting into Non-Stackable vs. Stackable Evaluation Groups
       │
       ▼
Phase 4: Sequential 11-Stage Validation Pipeline (Checks a to k)
       │
       ▼
Phase 5: Proportional Discount Split Across Qualifying Items & Remainder Reconciliation
       │
       ▼
Phase 6: Re-ordering Reported Coupons into Original Customer Entry Order
       │
       ▼
Phase 7: Final Computation of Subtotal, Net Amount, 7% VAT, and Total
```

---

## 11. Monetary Precision & Round-Half-Up Strategy

### The Problem with JavaScript Numbers
In standard JavaScript floating point arithmetic (IEEE-754 double precision):
- `0.1 + 0.2 === 0.30000000000000004`
- `(1.005).toFixed(2) === "1.00"` (because `1.005` is stored internally as `1.0049999999999998934...`)

### Our Solution
All monetary calculations are performed using an isolated `Decimal.clone()` from `decimal.js`:
```typescript
export const MoneyDecimal = Decimal.clone({
  rounding: Decimal.ROUND_HALF_UP,
  precision: 28
});
```
- **Round-Half-Up:** Standard round half up to 2 decimal places (`0.125 -> 0.13`, `1.005 -> 1.01`).
- **Formatting:** All monetary values transmitted over HTTP or saved to the database are stringified with exactly two decimal places (`"3450.50"`).
- **Zero Floating Point in Logic:** No `parseFloat`, standard JavaScript arithmetic operators, or native `toFixed()` are used in financial calculations.

---

## 12. Coupon Evaluation & Stacking Rules

### Evaluation Order
1. **Non-Stackable Coupons First (`stackable === false`):** Evaluated before stackable coupons. If two non-stackable coupons are entered, the first is evaluated; the second is evaluated next and rejected with `"This code can't be combined with {CODE}."`.
2. **Stackable Coupons Second (`stackable === true`):** Can combine with a previously applied non-stackable coupon or other stackable coupons.
3. **Preserving Customer Input Order:** Regardless of evaluation order, response results are re-sorted back into the customer's original entry sequence.

### 11-Stage Validation Pipeline (Checks a through k)
Evaluated strictly in order; the first failing condition determines the exact rejection message:
1. **(a) Code exists:** `"We don't recognise this code."`
2. **(b) Active status:** `"This code is no longer active."`
3. **(c) Today >= startsOn (Bangkok UTC+07:00):** `"This code starts on {startsOn}."`
4. **(d) Today <= endsOn (inclusive):** `"This code expired on {endsOn}."`
5. **(e) usedCount < usageLimit:** `"This code has been fully used."`
6. **(f) Logged in check:** `"Log in to use this code."` (if coupon has `perCustomerLimit` or `firstOrderOnly` and `customerId` is null)
7. **(g) Customer usage < perCustomerLimit:** `"You've already used this code."`
8. **(h) firstOrderOnly check:** `"This code is only for your first order."` (if customer has `ordersCount > 0`)
9. **(i) Non-stackable compatibility:** `"This code can't be combined with {CODE}."`
10. **(j) Scope match:** `"No items in your cart qualify for this code."`
11. **(k) Eligible spend >= minSpend:** `"Spend ฿{missing} more on eligible items to use this code."` (formatted with commas and 2 decimals)

---

## 13. Discount Allocation Strategy

To facilitate refunds and itemized auditing, discounts are allocated to individual cart lines:

1. **Identify Eligible Lines:** Lines matching the coupon's scope (`all`, `type: lab_test`, or `provider: 48`).
2. **Compute Base Share:** Each qualifying line receives:
   $$\text{share}_i = \text{round\_half\_up}\left(\frac{\text{discount} \times \text{currentLineAmount}_i}{\text{eligibleAmount}}\right)$$
   where $\text{currentLineAmount}_i$ is the line amount *after* prior coupons have been applied.
3. **Reconcile Discrepancy:** Sum the rounded shares:
   $$\text{diff} = \text{discount} - \sum \text{share}_i$$
   If $\text{diff} \neq 0$, the discrepancy is added or subtracted from the qualifying line with the largest amount. If multiple lines tie for the largest amount, the difference is allocated to the **first** qualifying line.
4. **Update Remaining Amount:** $\text{currentLineAmount}_i = \text{currentLineAmount}_i - \text{share}_i$.

---

## 14. Database Design & Persistence

Persistent storage is backed by SQLite (`better-sqlite3`) configured with Write-Ahead Logging (`PRAGMA journal_mode = WAL`) and foreign key constraints.

### Schema Architecture
- **`services`:** Immutable catalog of services (`id`, `title`, `type`, `provider_id`, `provider_name`, `price`).
- **`customers`:** Customer records (`id`, `name`, `orders_count`).
- **`coupons`:** Coupon definitions and global counts (`code`, `type`, `value`, `min_spend`, `max_discount`, `starts_on`, `ends_on`, `usage_limit`, `used_count`, `per_customer_limit`, `first_order_only`, `stackable`, `status`).
- **`coupon_usages`:** Per-customer redemption tracking (`coupon_code`, `customer_id`, `used_count`).
- **`orders`:** Placed orders (`id`, `customer_id`, `subtotal`, `discount_total`, `net_amount`, `vat`, `total`, `created_at`, `quote_data`).
- **`order_items` & `order_coupons`:** Itemized line items and applied coupon discounts.

### Controlled Seeding
Seeding only occurs on the first run when `services` has zero records. If the SQLite database file already exists, it is never overwritten, preserving updated `used_count` and `orders_count` across server restarts.

---

## 15. How Concurrent Coupon Redemption is Handled

### The Problem
A pre-check like `if (usedCount < usageLimit)` followed by an `UPDATE` introduces a Time-of-Check to Time-of-Use (TOCTOU) race condition. If two requests for `LASTONE` (which has 1 redemption left) arrive simultaneously, both pre-checks would pass, leading to over-redemption.

### The Solution
1. **Immediate Transaction:** We acquire an immediate lock using `db.transaction(...).immediate()`.
2. **Atomic Conditional Updates:**
   ```sql
   UPDATE coupons
   SET used_count = used_count + 1
   WHERE code = ?
     AND (usage_limit IS NULL OR used_count < usage_limit);
   ```
3. **Rollback on Zero Changes:**
   If `changes === 0`, another transaction consumed the quota first. The transaction throws a `StaleQuoteConflictError`, causing an immediate transaction rollback.
4. **Per-Customer Atomic Upserts:**
   ```sql
   INSERT INTO coupon_usages (coupon_code, customer_id, used_count)
   VALUES (?, ?, 1)
   ON CONFLICT(coupon_code, customer_id) DO UPDATE SET
     used_count = coupon_usages.used_count + 1
   WHERE coupon_usages.used_count < ?;
   ```
   If `changes === 0`, the per-customer limit was reached, triggering immediate rollback and an HTTP 409 response.

---

## 16. Known Limitations

- **Single-Node Persistence:** SQLite runs locally on the host filesystem. In a distributed multi-node cloud deployment, a centralized database (such as PostgreSQL with row-level locks) would be required.
- **In-Memory Catalog Caching:** Catalog data is queried directly from SQLite for each quote. In high-traffic production, catalog queries would benefit from Redis caching with invalidation hooks.
- **Fictional Authentication:** In accordance with assessment instructions, customer authentication is simulated via customer ID selection rather than full JWT/OAuth sessions.

---

## 17. What I Would Improve with More Time

1. **PostgreSQL Migration:** Move to PostgreSQL utilizing `SELECT ... FOR UPDATE` row-level locks for horizontal database scaling.
2. **WebSocket Price Updates:** Push live notifications when a coupon in a customer's cart is claimed by another user in real time.
3. **Refund & Partial Cancellation API:** Extend the line-item discount tracking tables to support partial order returns and proportional satang-accurate refund calculations.
4. **Automated E2E Playwright Tests:** Incorporate Playwright browser automation into CI for end-to-end user journey tests across mobile and desktop viewports.

---

## 18. AI Usage Disclosure

In compliance with assessment requirements:
- AI assistance (Antigravity AI) was utilized as an interactive pair-programming collaborator for code scaffolding, drafting unit tests, and verifying boundary conditions.
- All financial calculation algorithms, round-half-up configurations, discount distribution logic, database transaction mechanics, and concurrency handling have been reviewed line-by-line, verified through 65 automated tests, and are fully understood by the author for live demonstration during the interview.
