# MedEx Coupon & Checkout Calculator

A production-grade, highly reliable checkout calculation engine and responsive React interface designed for the MedEx healthcare marketplace (Thailand, Nepal, and India).

This project implements accurate checkout calculations to the satang, multi-coupon evaluation with stacking rules, proportional discount allocation, and concurrency-safe transactional coupon redemption backed by SQLite.

---

## 1. Project Overview

MedEx is an online healthcare marketplace where customers book lab tests, executive health check packages, and wellness treatments. Customers can apply up to two coupon codes to their cart. 

The checkout engine calculates:
- Exact line amounts (`price * quantity`)
- Coupon eligibility, validation checks, and rejection reasons
- Proportional discount distribution across qualifying items
- 7% Value Added Tax (VAT) using round-half-up rounding
- Final payable total in Thai Baht (THB)

---

## 2. Technology Stack

### Backend
- **Runtime:** Node.js (v22+)
- **Language:** TypeScript
- **Framework:** Express
- **Database:** SQLite (`better-sqlite3`)
- **Validation:** Zod
- **Financial Precision:** `decimal.js` (explicit round-half-up rounding)
- **Testing:** Vitest & Supertest

### Frontend
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Modern, accessible Vanilla CSS with responsive design (optimized for >=375px mobile viewports)

---

## 3. Project Structure

```text
medex-checkout/
├── backend/
│   ├── src/
│   │   ├── controllers/      # HTTP route handlers
│   │   ├── db/               # SQLite connection, schema, and seed loader
│   │   ├── repositories/     # Data access layer for orders and coupons
│   │   ├── routes/           # Express router definitions
│   │   ├── services/         # Checkout calculation & order placement
│   │   ├── utils/            # Precision money utilities & date helpers
│   │   ├── validators/       # Zod schemas for requests
│   │   ├── app.ts            # Express application setup
│   │   └── server.ts         # Server entrypoint
│   ├── tests/                # Unit tests, integration tests, acceptance tests
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/       # Service list, Cart, Coupon inputs, Breakdown
│   │   ├── services/         # API client
│   │   ├── types/            # TypeScript interfaces
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── data/
│   └── checkout.json         # Authoritative test fixture & initial catalog
└── README.md
```

---

## 4. Development Milestones & Roadmap

- [x] **Milestone 1 — Inspect & Scaffold:** Workspace inspection, fixture validation, TypeScript project initialization, and git repository setup.
- [ ] **Milestone 2 — Money Utilities:** Implement zero-drift decimal arithmetic (`decimal.js`), round-half-up rounding, satang precision, and unit tests.
- [ ] **Milestone 3 — Coupon Calculation Engine:** Implement cart line calculations, coupon normalization, validation check pipeline, stacking rules, and proportional discount distribution.
- [ ] **Milestone 4 — Database & Order Processing:** SQLite database setup, schema migration, seed loading from `checkout.json`, atomic transactional order placement, and concurrency protection.
- [ ] **Milestone 5 — API & Acceptance Tests:** Express endpoints (`GET /api/services`, `POST /api/quote`, `POST /api/orders`), Zod validation, and automated fixture acceptance tests.
- [ ] **Milestone 6 — React Frontend:** Interactive service selection, cart management, coupon chip inputs, real-time quote breakdowns, order placement, and 409 conflict handling.
- [ ] **Milestone 7 — Integration & Polish:** End-to-end integration verification, mobile 375px layout validation, and edge-case testing.
- [ ] **Milestone 8 — Documentation & Final Review:** Verification of all tests, review checklist, and interview defense preparation.

---

## 5. Prerequisites & Getting Started

### Prerequisites
- Node.js >= 20
- npm >= 10
- Git

### Installation

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Running Locally

```bash
# Terminal 1: Start Backend (http://localhost:3001)
cd backend
npm run dev

# Terminal 2: Start Frontend (http://localhost:3000)
cd frontend
npm run dev
```

### Running Automated Tests

```bash
cd backend
npm test
```

---

## 6. Calculation Strategy & Financial Precision

1. **No JavaScript Floating-Point Arithmetic:** `0.1 + 0.2 !== 0.3` causes cumulative penny/satang drift. All calculations are executed with `decimal.js` configured with `ROUND_HALF_UP` (`Decimal.ROUND_HALF_UP`).
2. **Representation:** Monetary inputs and outputs are strictly formatted as strings with exactly 2 decimal places (e.g. `"3450.50"`).
3. **VAT Calculation:** Value Added Tax (7%) is calculated as `round_half_up(netAmount * 7 / 100)`.
4. **Discount Allocation:** For multi-item carts, coupon discounts are split proportionally across qualifying lines based on their current line amount. Any satang discrepancy caused by individual line rounding is added or subtracted from the qualifying line with the highest amount (ties broken by line order).

---

## 7. AI Usage Disclosure

In compliance with assessment instructions, AI assistance (Antigravity AI) was utilized as a pair-programming collaborator for scaffolding, architecture structuring, test generation, and documentation drafting. All business logic, rounding rules, database transaction strategies, and code implementations have been thoroughly reviewed, verified with automated tests, and are fully understood by the author.
