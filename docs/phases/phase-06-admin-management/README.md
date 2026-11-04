# Phase 06: Admin management

**Status:** Completed. **Last verified:** 2026-11-04, Africa/Johannesburg.
**Branch:** [phase/06-admin-management](https://github.com/JerivasioYawa/EbenStudios/tree/phase/06-admin-management), based on Phase 5 commit
`c61fd1102ed7459f4ab5dd92f61fcf523e964b60`.

Extend the existing admin product, order and dashboard pages with server-side
search/filtering/pagination, archive/restore, validated uploads, reasoned stock
adjustments, audit records, order history, enforced transitions, payment records,
shipping references, safe cancellation and accurate payment totals.

The existing admin layout and routes are reused. Tests create disposable users,
products, orders and uploads, independently of personal admin credentials. The
development database is preserved. See [verification.md](verification.md).

## Relevant files

| File | Responsibility |
| --- | --- |
| [Schema](../../../backend/prisma/schema.prisma) | Archive/threshold fields, payment/fulfilment state, audit, stock, history and payment models |
| [Migration](../../../backend/prisma/migrations/20261104174440_admin_management/migration.sql) | Additive columns/tables, truthful historical backfill, retained cent/quantity CHECK constraints |
| [Admin routes](../../../backend/src/routes/admin.routes.js) | Admin-only lists, filters, pagination, history, adjustments, lifecycle actions and dashboard |
| [Admin helpers](../../../backend/src/lib/admin.js) | Validation, actor snapshots, audit transaction, lock/retry and stock records |
| [Order management](../../../backend/src/lib/order-management.js) | Enforced transitions, once-only cancellation, payment/refund records, shipping references and exact dashboard aggregates |
| [Product routes](../../../backend/src/routes/product.routes.js) | Validated creation/editing, initial stock records, protected deletion and upload lifecycle |
| [Upload middleware](../../../backend/src/middleware/upload.js) | Size/type limits, actual decoding/normalization and safe file cleanup |
| [Checkout](../../../backend/src/lib/checkout.js), [cart](../../../backend/src/routes/cart.routes.js), [likes](../../../backend/src/routes/like.routes.js) | Block archived purchases, record order creation, hide archived catalogue likes |
| [Legacy order routes](../../../backend/src/routes/order.routes.js), [Express app](../../../backend/src/app.js) | Same transition rules on the earlier endpoint, admin routing and HTTP error mapping |
| [Product page](../../../frontend/src/pages/admin/Products.jsx) | Search, filters, pagination, editor, archive/restore, stock reason form and history |
| [Order page](../../../frontend/src/pages/admin/Orders.jsx) | Search/filters, customer/address/items/history, payments, fulfilment, cancellation/refund/shipping controls |
| [Dashboard](../../../frontend/src/pages/admin/Dashboard.jsx) | Server payment totals, separate refunds/pending counts, low stock and admin activity |
| [Admin service](../../../frontend/src/service/adminService.js), [query hook](../../../frontend/src/hooks/useAdminQuery.js), [controls](../../../frontend/src/components/admin/ManagementControls.jsx) | API contracts, aborting stale results, pagination and error/retry states |
| [Customer orders](../../../frontend/src/pages/Orders.jsx), [product service](../../../frontend/src/service/productService.js) | Separate customer-visible states/shipping reference and clearing optional product text |
| [API tests](../../../backend/test/api.test.js), [migration test](../../../backend/test/admin-migration.test.js) | Authorization, validation, cleanup, concurrency, lifecycle, totals and historical preservation |
| [Migration verifier](../../../backend/scripts/verify-admin-migration.js), [helper](../../../backend/test-support/admin-migration.js) | Disposable-copy and actual-development comparison without printing private rows |
| [Frontend tests](../../../frontend/src/pages/admin/Management.test.jsx), [query tests](../../../frontend/src/hooks/useAdminQuery.test.jsx) | Editor/filter/payment/error behavior, pending inputs and stale search suppression |
| [Browser management journeys](../../../frontend/e2e/admin-management.spec.js), [existing admin journeys](../../../frontend/e2e/admin.spec.js) | Real UI/API/data verification, upload editing and complete fulfilment |

The [backend lockfile](../../../backend/package-lock.json) adds Sharp 0.35.5 and
compatible runtime security patches, including Multer 2.5.0. Existing historical
test helpers and the Phase 5 copy-verifier now support a frozen migration boundary,
so later migrations do not invalidate earlier phase conversion tests.

## Prerequisites and migration

Start at the repository root. Reuse the environment from
[Phase 01](../phase-01-local-setup/README.md) and test installation from
[Phase 02](../phase-02-test-setup/README.md). Run `npm.cmd ci` in backend after
pulling this phase, then generate Prisma Client. Sharp installs its platform
binary through the locked optional dependencies. No external payment credentials
or new environment variables are required.

The verified runtime is Node 26.12.0, npm 11.20.0, Prisma 5.22.0, Vite 8.3.5,
Vitest 5.1.0 and Playwright 1.64.1 with Chromium. Migration assertions use
Node's built-in node:sqlite DatabaseSync API.

A consistent ignored backup was taken before editing the schema. The generated
draft rebuilt Product and Order, which would discard Phase 5 CHECK constraints.
The reviewed migration instead uses ALTER TABLE ADD COLUMN and new tables/indexes
inside one transaction. Existing data, references and sequence high-water marks
are retained. The disposable-copy check passed before development was migrated.

Existing Paid/Shipped/Delivered orders become paymentStatus=Unverified; a legacy
label is not evidence of payment. Fulfilment preserves Shipped, Delivered or
Cancelled where recorded. Imported history explains this limitation. Existing
inventory is never recalculated. Unknown legacy stock restoration times remain
null; terminal Cancelled orders cannot restock again. No payment receipts are invented.

For an existing pre-admin database, first create a consistent local backup using
SQLite's backup API or VACUUM INTO. Substitute its path and run from backend:

~~~powershell
Push-Location backend
try {
    node scripts/verify-admin-migration.js prisma/backups/pre-admin.db
} finally {
    Pop-Location
}
~~~

Expected: preserved=true, matching original fields/relationships/sequences,
retained cent/quantity constraints and integrity=ok. Only a disposable copy is
migrated; the supplied backup is not changed. The input must predate Phase 6.

After successful copy verification, deploy the recorded migration:

~~~powershell
Push-Location backend
try {
    npm.cmd ci
    npx.cmd prisma validate
    npx.cmd prisma migrate deploy
    npx.cmd prisma generate
    npx.cmd prisma migrate status
} finally {
    Pop-Location
}
~~~

Run commands one at a time and stop on a nonzero exit code. Expected: seven
migrations applied/already applied, generated client and schema up to date.
Implementation also ran format, validate, migrate dev --name admin_management
--create-only for review, then migrate dev --name admin_management and generate.
Do not regenerate an already published migration or accept a reset of useful data.

## Product and audit contracts

Every /api/admin route requires verified ADMIN role: guests receive 401 and
customers receive 403 before validation or writes. Actor ID/name/email come from
the verified session, not the submitted body. Audit and stock writes share the
business transaction. Failed saves roll everything back. Successful admin requests,
including safe replays, are audited; order history/stock ledgers record actual changes.

| Method/route | Input and behavior |
| --- | --- |
| GET /api/admin/products | q, tag, status=active/archived/all, stock=all/low/out/available, page, pageSize |
| PATCH /api/admin/products/:id/archive | archived boolean and required reason; restores with archived=false |
| POST /api/admin/products/:id/stock-adjustments | Nonzero signed integer delta and required reason; bounded stock, actor/time/before/after recorded |
| GET /api/admin/products/:id/history | Paginated adjustments and product audit entries |
| GET /api/admin/audit | Paginated activity; optional entityType=Product/Order and entityId |
| POST /api/products | Existing admin-only creation route; validated fields and initial stock record |
| PUT /api/products/:id | Existing admin-only editor; stock changes also require stockReason |
| DELETE /api/products/:id | Allowed only without order references; ordered products must be archived |

Lists return items, total, page, pageSize and totalPages. Page sizes are 1–100;
default is 10. Product search matches name/description; tag filtering is exact.
Low stock means stock <= the product's lowStockThreshold (default 5).

Name is required and limited to 120 characters; description 5,000; tag 80;
reasons 500. Price accepts the Phase 5 decimal rand contract (at most two decimal
places). Stock and thresholds are nonnegative bounded integers. Optional text can
be cleared. The editor changes inventory through the separate reasoned adjustment
form, so saving a product description cannot overwrite stock changed by checkout.

Archived products disappear from the shop and active likes views. Public details
return 404. Cart add/update and checkout reject archived products, including those
already in saved carts. Stock is not reserved by a cart. Restore makes the product
available again. Order snapshots and existing relationships remain intact.
Archived favourites remain stored, and authenticated like PUTs still acknowledge
them so a guest preference merge cannot get stuck. They are hidden from active
likes lists until the product is restored.

Uploads allow JPEG/PNG/WebP/GIF only, with a 5 MB input limit and 20 million input
pixels. Sharp checks the decoded format against the MIME label, decodes pixels,
normalizes the first frame to PNG up to 1600×1600, and discards metadata. Fake,
truncated, oversized or mismatched content is rejected. Failed database saves
remove the new file. Replaced/deleted images are removed only when no current
product or historical order snapshot references them. History images stay usable.
See the primary [Sharp input guidance](https://sharp.pixelplumbing.com/api-constructor/).

## Order, payment and shipping contracts

| Method/route | Behavior |
| --- | --- |
| GET /api/admin/orders | q, paymentStatus, fulfilmentStatus, page, pageSize |
| GET /api/admin/orders/:id | Customer/address, snapshot items, payment records and chronological actor history |
| PATCH /api/admin/orders/:id/fulfilment | Validated fulfilmentStatus; shippingReference required to ship |
| POST /api/admin/orders/:id/cancel | Required reason; restores all eligible stock once, including archived products |
| POST /api/admin/orders/:id/payments | reference and amountCents matching the full order total; records verified manual payment |
| POST /api/admin/orders/:id/refunds | reference and full amountCents; records an already processed refund for a cancelled confirmed payment |
| PATCH /api/admin/orders/:id/shipping | Required shippingReference and reason; allowed while Processing/Shipped |
| GET /api/admin/dashboard | Exact payment aggregates, counts, recent orders and low-stock products |

Order search matches order ID (#EB-123), saved customer name/email, address and
saved product names. Payment states: Pending, Unverified, Confirmed, RefundRequired,
Refunded. Fulfilment states: Unfulfilled, Processing, Shipped, Delivered, Cancelled.

Allowed fulfilment sequence is Unfulfilled → Processing → Shipped → Delivered.
Payment must be Confirmed before progressing. Cancellation is allowed only from
Unfulfilled/Processing; Cancelled and Delivered are terminal. Shipped orders cannot
be cancelled through this workflow. Invalid transitions receive 409 without any
state/history/audit/stock changes. Missing references/invalid input receive 400.
The earlier /api/orders/:id/status endpoint enforces the same transitions and
cannot mark an order Paid without a payment record.

Payment references are globally unique and each order has at most one Confirmation
and one Refund. Replaying the same reference/amount returns the existing result;
conflicting details receive 409. References are required (up to 200 characters).
These are manual confirmation/refund records: the application does not charge a
card, query a payment provider or transfer a refund.

Cancellation, all stock restorations, the status marker, history and audit commit
together. A failure restoring any line rolls back the whole cancellation. Repeated
or concurrent cancellation does not restore stock again. Confirmed payments move
to RefundRequired; recording the processed refund moves them to Refunded. Deleted
legacy product references or stock overflow require review before cancellation.

Dashboard confirmedPaymentsCents sums real Confirmation records for Confirmed,
non-cancelled orders. Pending/Unverified orders and all cancelled values are excluded.
awaitingRefundCents and refundedCents are shown separately. Aggregates are decimal
cent strings calculated with BigInt; the frontend formats them exactly. Counts and
totals are queried across all records, independently of the current list page.

## Rerun the full checkpoint

From the repository root, run each command in order and stop on failure:

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

Expected: 60 backend tests (55 API, 5 migration), 60 frontend tests, clean ESLint,
successful build and 14 Chromium journeys. The test runners create their own
temporary databases even if DATABASE_URL points to test.db. Browser servers use
their own database, credentials, uploads and ports 4100/4173. Reports/screenshots
stay ignored under frontend/test-results and playwright-report.

## Checkpoint and remaining notes

| Action | Verified result |
| --- | --- |
| Admin creates/edits product | Changes persist after reload and appear in public API/shop |
| Admin archives product | Hidden from shop; saved-cart checkout also rejects it; history remains |
| Customer calls admin API | 403 on all management endpoints |
| Invalid order transition | 409 with unchanged order, stock, payment records and history |
| Admin cancels twice/concurrently | Exactly one stock restoration and cancellation history event |
| Admin adjusts stock | Verified actor, trimmed reason, time, delta and before/after stock saved |
| Dashboard displays payments | Confirmed receipts only; pending/cancelled values excluded, refunds separate |

All required checkpoints passed. Two moderate npm advisories remain in the
development-only nodemon/minimatch chain; npm's suggested force fix would downgrade
nodemon across major versions and was not applied. `npm.cmd audit --omit=dev`
reports zero vulnerabilities. Existing Node/Vite deprecation and color-environment
warnings do not prevent checks passing. Phase 7 has not been started.
