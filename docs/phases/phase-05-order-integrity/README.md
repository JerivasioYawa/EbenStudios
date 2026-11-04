# Phase 05: Order integrity

**Status:** Completed. **Last verified:** 2026-11-04, Africa/Johannesburg.
**Branch:** [phase/05-order-integrity](https://github.com/JerivasioYawa/EbenStudios/tree/phase/05-order-integrity).
**Base:** completed Phase 4, commit `192d7653ab037384c30f5a2dda46b4bb243bb13f`.

Money is stored and calculated as integer ZAR cents. Checkout commits the order,
stock changes and cart clearing together. A durable key makes retries return the
same order, and historical customer/product details are stored with that order.

## Relevant files

| File | Responsibility |
| --- | --- |
| [Schema](../../../backend/prisma/schema.prisma) | Cent amounts, historical fields, nullable product relation and account/key uniqueness |
| [Migration SQL](../../../backend/prisma/migrations/20261104170707_order_integrity/migration.sql) | Transactional conversion, backfill, constraints, row/foreign-key guards and sequence preservation |
| [Backend money](../../../backend/src/lib/money.js) | Decimal input parsing and bounded integer-cent arithmetic |
| [Checkout](../../../backend/src/lib/checkout.js) | Verified user ownership, durable claim, current stock/prices and transaction retries |
| [Order routes](../../../backend/src/routes/order.routes.js) | Required checkout header, replay responses and history/status endpoints |
| [Serializers](../../../backend/src/lib/serializers.js) | Cent fields and compatibility aliases derived from saved snapshots |
| [Product routes](../../../backend/src/routes/product.routes.js), [seed](../../../backend/prisma/seed.js) | Validated price/stock input and cent-based seed constants |
| [Migration verifier](../../../backend/scripts/verify-order-integrity-migration.js), [helpers](../../../backend/test-support/order-integrity-migration.js) | Compare an upgraded disposable copy against the complete expected conversion |
| [API tests](../../../backend/test/api.test.js), [migration tests](../../../backend/test/order-integrity-migration.test.js) | Arithmetic, rollback, concurrency, retry, history, conversion and failure preservation |
| [Frontend money](../../../frontend/src/lib/money.js) | BigInt cart totals and exact two-decimal formatting |
| [Checkout attempts](../../../frontend/src/service/checkoutAttempt.js), [order service](../../../frontend/src/service/orderService.js) | Persisted account-scoped retry key and request header |
| [Cart provider](../../../frontend/src/context/CartContext.jsx) | Retry acknowledgement and cart intent changes |
| [Cart](../../../frontend/src/pages/Cart.jsx), [checkout](../../../frontend/src/pages/Checkout.jsx), [history](../../../frontend/src/pages/Orders.jsx) | Exact amounts, retry errors and historical product names |
| [Admin dashboard](../../../frontend/src/pages/admin/Dashboard.jsx), [orders](../../../frontend/src/pages/admin/Orders.jsx), [products](../../../frontend/src/pages/admin/Products.jsx) | Exact amounts and saved customer details |
| [Browser journey](../../../frontend/e2e/order-integrity.spec.js) | Real commit with a lost receipt, safe retry, exact cents and product edits/deletion |

Product cards/details, cart/likes API responses and authentication middleware also
carry cent values or the verified customer name needed for the snapshot.

## Prerequisites

Start at the repository root. Keep the locked dependencies and ignored local
environment configured in [Phase 01](../phase-01-local-setup/README.md).
Use [Phase 02](../phase-02-test-setup/README.md) for Chromium installation and test
server setup. No new dependencies or credentials are needed. Migration tests use
Node's built-in `node:sqlite` DatabaseSync API; the verified runtime is Node 26.12.0.

Stop development writers before making a consistent backup. Keep all database
copies and credentials local and ignored. The test runners create their own
temporary databases, users, products and uploads; they do not use the personal admin.

## Migration and backfill

Migration `20261104170707_order_integrity` contains the reviewed SQL. It:

1. Converts Product.price, Order.total and OrderItem.price from rand to cents with
   `CAST(ROUND(amount * 100) AS INTEGER)`, rounding existing nonnegative amounts to
   the nearest cent. Historical unit prices come from OrderItem, not today's product.
2. Keeps every original ID, timestamp, status, address and relationship. The migration
   snapshots the available user name/email and product name/description/image URL.
   Earlier names/images that were never stored cannot be reconstructed.
3. Preserves the rounded original charged header total. `adjustmentCents` records
   any difference from the converted line sum, including historical empty orders
   and sub-cent rounding discrepancies. New orders have zero adjustment.
4. Assigns existing orders stable keys `legacy-order-<id>`, and adds uniqueness on
   `(userId, idempotencyKey)`. Product deletion sets an order line's productId to
   null while retaining its saved details. User/order relationships remain protected.
5. Adds SQL CHECK constraints for valid cent amounts, stock and positive whole
   quantities. It refuses unsafe legacy values, orphaned rows or cardinality loss.
   Table replacement, sequence preservation and foreign-key verification occur
   inside one transaction; failure rolls back the original business records.

The original create-only command was attempted, but Prisma refused this
noninteractive terminal and identified the required-column conversion as unsafe.
The draft was generated with Prisma migrate diff against the backup, then replaced
with the deliberate conversion above. No reset or destructive draft was applied.
The SQL was opened in VS Code and tested on a disposable copy before development.
See [verification.md](verification.md) for the actual sequence and results.

For an existing pre-integrity database, first create a consistent backup using
SQLite's backup API or VACUUM INTO. With its path substituted below, run from backend:

~~~powershell
Push-Location backend
try {
    code prisma/migrations/20261104170707_order_integrity/migration.sql
    node scripts/verify-order-integrity-migration.js prisma/backups/pre-integrity.db
} finally {
    Pop-Location
}
~~~

Expected: `preserved: true`, matching per-table counts, integrity `ok`, no foreign-key
violations, and preserved sequence high-water marks. The script upgrades a disposable
copy and cleans it afterward; it never migrates the supplied backup. A current
post-integrity database is not a suitable input for this legacy conversion check.

After successful copy verification, deploy the committed migration:

~~~powershell
Push-Location backend
try {
    npx.cmd prisma validate
    npx.cmd prisma migrate deploy
    npx.cmd prisma generate
    npx.cmd prisma migrate status
} finally {
    Pop-Location
}
~~~

Run each command individually and stop on any failure. Fresh databases apply all
six migrations. Existing migrated databases report no pending migration. Do not
regenerate this migration or accept a reset of useful data. During implementation,
the requested `prisma migrate dev`, generate and status commands also passed after
copy verification, without a reset.

## Money and checkout contract

Canonical API amounts are `priceCents`, `unitPriceCents`, `lineTotalCents` and
`totalCents`, with order currency `ZAR`. Cart arithmetic and dashboard aggregation
use BigInt on the frontend. Formatting always shows two decimals, including R0.87.
Compatibility numeric rand aliases `price` and `total` remain derived values;
checkout never trusts them or a submitted product list/total.

Admin product input still accepts `price` in rand as a decimal string or number
with at most two decimal places. Negative, fractional-stock, nonnumeric,
exponent-string and excessive values fail. Each stored amount, line and order
total is bounded by Prisma Int: 2,147,483,647 cents (R21,474,836.47).
Quantities must be positive integers within the Prisma Int range and available stock.

Authenticated `POST /api/orders` reads the saved cart owned by the verified user.
Send a UUID v4 `Idempotency-Key` header and optional shippingAddress (up to 2,000
characters). Keep the same key when retrying an uncertain result.

| Outcome | Response |
| --- | --- |
| New order committed | 201, order with saved items; Idempotency-Replayed: false |
| Same account/key retried | 200, existing order; Idempotency-Replayed: true |
| Same key with different shipping | 409; no second order |
| Missing/invalid key or cart/quantity/amount | 400; no partial order |
| Insufficient current stock | 409; all writes roll back and cart is retained |
| Temporary database contention after bounded retries | 503; retry the same key |
| Missing/expired session | 401 before checkout writes |

The transaction's first write creates the order claim, acquiring SQLite's writer
lock before cart/stock reads. Conditional stock decrements and line snapshots,
order finalization and cart clearing commit together. A unique account/key pair
prevents duplicate orders across requests/clients; no in-memory mutex is required.
Cart contents do not reserve stock. Product/customer edits leave saved order fields
unchanged. Compatibility product/user objects are built from snapshots too.

## Browser retry behavior

An attempt key is stored under `eben_checkout_attempt_v1:<userId>` before checkout.
The same cart IDs/quantities and trimmed shipping address reuse it after a failed
response or page reload. Acknowledgement clears only that attempt; a successful
cart edit discards the old intent. Different accounts have different keys.
If browser storage is unavailable, checkout fails clearly before sending the order.

After a lost response, pressing Place Order again can retrieve the committed order.
If a refresh loads an empty server cart with a pending attempt, checkout directs the
customer to review order history. It does not infer failure from the empty cart.

## Rerun checks

Run from the repository root, stopping if any command fails:

~~~powershell
Push-Location backend
$previousDatabaseUrl = $env:DATABASE_URL
try {
    $env:DATABASE_URL = 'file:./test.db'
    npx.cmd prisma migrate deploy
    npm.cmd test
} finally {
    if ($null -eq $previousDatabaseUrl) {
        Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    } else {
        $env:DATABASE_URL = $previousDatabaseUrl
    }
    Pop-Location
}
Push-Location frontend
try {
    npm.cmd test
    npm.cmd run lint
    npm.cmd run build
    npm.cmd run test:e2e
} finally {
    Pop-Location
}
~~~

Expected: 45 backend assertions (41 API plus 4 migration tests), 51 frontend tests,
clean ESLint, a successful Vite build and 12 passing Chromium journeys. API tests
create fresh temporary databases even when DATABASE_URL points at test.db. Browser
tests use separate temporary databases and ports, never the development server.

## Checkpoint

| Scenario | Verified result |
| --- | --- |
| R0.29 times three | Stored/displayed as exactly 87 cents / R0.87 |
| Negative and fractional quantities | API rejects them; database guards also reject invalid saved rows |
| Later item lacks stock | No order, stock decrement or cart clearing is committed |
| Simultaneous purchases of last unit | One winner, one stock conflict, zero remaining stock; verified over HTTP and separate Prisma clients |
| Concurrent/later checkout retries | One order/stock decrement; browser lost-receipt retry returns that order |
| Product/customer edits and product deletion | Historical details and totals stay saved; deletion only nulls the product relation |
| Existing records | Real database copy and development verification preserve every expected converted row; historical fixtures also preserve orders, carts, likes and sequences |

No failing checkpoint remains. Detailed results, warnings and resolved issues are
in [verification.md](verification.md). Phase 6 has not been started.
