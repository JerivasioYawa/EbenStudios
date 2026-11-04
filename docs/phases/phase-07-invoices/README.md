# Phase 07: Invoices

**Status:** Completed. **Last verified:** 2026-11-04, Africa/Johannesburg.
**Branch:** [phase/07-invoices](https://github.com/JerivasioYawa/EbenStudios/tree/phase/07-invoices), based on Phase 6 commit
`fa15c5b9f762dca426d9664c7c9e38f359d6caba`.

Implement immutable seller/billing/line snapshots, numbered and repeat-safe invoice
issuance, private PDFs, admin list/details, owning-customer access, recorded
void/corrections and issuance audit. Issuance must not confirm payment.

The existing admin application now includes invoice list/detail views and issuance
from order details. Customers can open their invoices from orders or profile.
All checkpoints passed; actual results are in [verification.md](verification.md).

## Relevant files

| File | Responsibility |
| --- | --- |
| [Schema](../../../backend/prisma/schema.prisma), [migration](../../../backend/prisma/migrations/20261104184859_invoices/migration.sql) | Invoice/order/customer relationships, stored lines, numbering sequence, lifecycle and snapshot guards |
| [Invoice service](../../../backend/src/lib/invoices.js) | Validation, repeat-safe issuance, snapshots, corrections/void, actor history and serialization |
| [PDF generator](../../../backend/src/lib/invoice-pdf.js) | Exact-cent A4 PDFs, wrapping, repeated table headers, continuation labels and page counts |
| [Fonts and license](../../../backend/assets/fonts/README.md) | Bundled Noto Sans Regular/Bold, pinned source/hash and Open Font License |
| [Invoice routes](../../../backend/src/routes/invoice.routes.js), [order routes](../../../backend/src/routes/order.routes.js) | Admin lists/issuance and authenticated owner/admin document access |
| [Express app](../../../backend/src/app.js) | Invoice routing and exposed download filename header |
| [Order management](../../../backend/src/lib/order-management.js), [admin helpers](../../../backend/src/lib/admin.js) | Cancellation voids active invoices in the same transaction; clear replay audit actions |
| [Invoice page](../../../frontend/src/pages/Invoices.jsx), [detail view](../../../frontend/src/components/invoices/InvoiceDetails.jsx) | Admin/customer lists, filters, stored details, PDF download, correction/void history |
| [Issuance panel](../../../frontend/src/components/invoices/OrderInvoices.jsx), [form](../../../frontend/src/components/invoices/InvoiceForm.jsx) | Seller/billing review and immutable-amount issuance/replacement forms |
| [Client service](../../../frontend/src/service/invoiceService.js) | Authenticated blob downloads, filename handling, error parsing and account-switch protection |
| [Admin layout](../../../frontend/src/components/admin/AdminLayout.jsx), [routes](../../../frontend/src/routes/AppRoutes.jsx) | Invoice navigation and protected customer/admin pages |
| [Customer orders](../../../frontend/src/pages/Orders.jsx), [profile](../../../frontend/src/pages/Profile.jsx) | Own-invoice entry points |
| [Environment example](../../../backend/.env.example) | Optional seller defaults; real values are entered locally or in the form |
| [API/PDF tests](../../../backend/test/invoices.test.js), [PDF reader](../../../backend/test-support/read-pdf.js) | Concurrency, ownership, snapshots, corrections, actual parsed amounts/positions and long documents |
| [Migration test](../../../backend/test/invoice-migration.test.js), [copy verifier](../../../backend/scripts/verify-invoice-migration.js) | Preserve every existing business table, field, constraint and sequence |
| [Frontend tests](../../../frontend/src/pages/Invoices.test.jsx), [download tests](../../../frontend/src/service/invoiceService.test.js) | Forms, access failures, filters, immutable amounts, authenticated downloads and stale-account rejection |
| [Browser journeys](../../../frontend/e2e/invoices.spec.js) | Real issuance/correction/customer downloads, ID substitution, long PDFs and reasoned void |
| [Preview renderer](../../../backend/scripts/render-invoice-preview.js) | Optional local PDF-to-PNG review using the test reader's canvas dependency |

## Prerequisites and seller details

Start at the repository root. Reuse [Phase 01](../phase-01-local-setup/README.md)
for local credentials and [Phase 02](../phase-02-test-setup/README.md) for test
installation. Use the locked dependencies with npm.cmd ci in backend/frontend.
PDFKit 0.20.2 is a runtime dependency. Mozilla PDF.js 6.5.438 is a development
dependency for independent text/page verification and previews. The fonts are
committed assets, so PDF generation works without operating-system fonts or a font host.

The verified environment is Node 26.12.0, npm 11.20.0, Prisma 5.22.0, Vite 8.3.5,
Vitest 5.1.0 and Playwright 1.64.1 with Chromium. Keep the normal development and
test database separation from earlier phases.

Before issuing a real invoice, enter seller name, email and postal address in the
admin issuance form. These required fields are copied into the invoice. Optional
seller defaults can be set in ignored backend/.env:

| Variable | Purpose |
| --- | --- |
| INVOICE_SELLER_NAME | Seller name; default form label is Eben Studios |
| INVOICE_SELLER_ADDRESS | Seller postal address |
| INVOICE_SELLER_EMAIL | Seller contact email |
| INVOICE_SELLER_PHONE | Optional phone |
| INVOICE_SELLER_REGISTRATION_NUMBER | Optional registration reference |
| INVOICE_SELLER_TAX_NUMBER | Optional tax registration reference |

No seller address/email/registration number was invented for development. Missing
details must be completed in the form. Billing defaults use the saved order customer
name/email/address and can be confirmed or corrected before issuance. Registration
references are optional recorded text. Amounts copy the order's stored ZAR amounts
and historical adjustment exactly; payment confirmation remains the Phase 6 workflow.

## Migration and data preservation

The reviewed migration `20261104184859_invoices` adds Invoice, InvoiceLine,
InvoiceEvent and InvoiceSequence. It does not alter/drop existing business tables,
recalculate orders, issue historical invoices or confirm payments. Existing rows,
foreign keys, sequence high-water marks and Phase 5/6 CHECK constraints are preserved.

Before migrating an existing database, stop writers and create a consistent ignored
backup using SQLite's backup API or VACUUM INTO. Substitute its pre-invoice path:

~~~powershell
Push-Location backend
try {
    node scripts/verify-invoice-migration.js prisma/backups/pre-invoices.db
} finally {
    Pop-Location
}
~~~

Expected: preserved=true, matching counts for all 11 previous business models,
identical original table definitions, integrity=ok and no foreign-key violations.
Only a disposable copy is migrated; the supplied backup stays unchanged.

After copy verification, deploy the committed migration:

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

Run each command individually and stop on failure. Expected: eight migrations
applied/already applied, generated client and schema up to date. Implementation
ran format, validate, migrate dev --name invoices --create-only for review, then
migrate dev --name invoices and generate, without a reset. Preserve the invoice
SQL triggers and partial unique index when reviewing future migrations.

## API and ownership

| Method/route | Access and result |
| --- | --- |
| POST /api/orders/:id/invoice | Admin; 201 for first issue, 200 for existing/latest invoice |
| GET /api/invoices | Admin; paginated list with q, status, orderId, page, pageSize |
| GET /api/invoices/config | Admin; seller form defaults |
| GET /api/invoices/mine | Authenticated account; paginated own invoices with the same filters |
| GET /api/invoices/:id | Admin or owning customer; stored details and lifecycle history |
| GET /api/invoices/:id/pdf | Admin or owning customer; private PDF attachment |
| POST /api/invoices/:id/void | Admin; required reason, retained document/history |
| POST /api/invoices/:id/corrections | Admin; required reason and optional corrected seller/billing/notes; linked replacement |

All routes require a verified bearer session. Guests receive 401; customer requests
to admin operations receive 403. A foreign customer's detail/PDF ID receives 404,
as does a nonexistent invoice. Ownership is stored from the verified order's user ID,
never a submitted customer ID or billing email. Changing billing details does not
transfer ownership. Customer responses omit internal issuer/history email fields.

Lists return items, total, page, pageSize and totalPages; pageSize is 1–100, default
10. Search matches invoice/order number or stored billing name/email. Public
statuses are Issued/Voided. Draft is an internal transaction state and is not exposed.

Issuance accepts seller, billing and notes. Required party name/email/address
lengths are 200/254/2,000 characters; optional registration references 80, seller
phone 60, notes 2,000. Void/correction reasons are required and limited to 500.
Unknown amount/quantity fields are rejected; stored order totals and line math
must reconcile before issuance. An empty or inconsistent legacy order requires review.

## Repeat safety, snapshots and corrections

Numbers use `INV-<UTC year>-<global sequence padded to six digits>`. The counter
never resets or reuses voided numbers. A database writer lock, number uniqueness,
unique (orderId, revision), unique correction source and one-issued-invoice-per-order
index make issuance/correction safe across concurrent requests.

The first transaction copies seller, billing, order reference/date, original customer,
notes, cent totals and ordered lines. Lines contain saved product names/descriptions,
quantity, unit price and line total. No current-product join is used for the document.
The invoice is sealed only after the line sum plus historical adjustment matches
its total. SQL guards reject snapshot edits, line changes/additions after sealing,
invoice deletion and history rewriting. Actor references may be nullified on user
deletion while their saved actor name/email remain.

Repeated issuance returns the existing latest revision, including a voided document,
and ignores proposed replacement details. Use the explicit correction workflow to
change seller/billing/notes. A correction voids an issued original and creates a new
number/revision linked in both directions, retaining the original financial lines
and amounts. Matching correction retries return the same replacement; conflicting
retries receive 409. Monetary corrections require a separate order workflow because
an invoice must continue to match the saved order.

Void preserves all snapshots and records actor/reason/time. Matching void retries
are safe; changing the original void reason receives 409. Cancelling an order also
voids its active invoice within the same stock/status/audit transaction. A cancelled
order cannot receive a new or replacement invoice. Every actual issuance, including
a replacement, has one issuance audit entry; replays use a distinct audit action.
Neither issuance, correction nor void creates payment-confirmation records.

## PDF generation and private downloads

PDFs are generated from stored invoice data on demand in memory and returned by
the authenticated route. No private PDF is written to uploads, public or another
static folder. Responses use application/pdf, attachment filename, private/no-store,
no-cache and nosniff headers. CORS exposes Content-Disposition so the browser can
use the invoice number as its filename. The client uses a bearer-authenticated blob
request, parses download errors, releases the object URL and rejects an old-account
response after logout/account switch.

The generator uses integer cents/BigInt formatting throughout. A4 pages wrap long
names/descriptions and addresses, repeat table headers and invoice/page references,
label continued items and keep totals in separate columns. Voided PDFs are visibly
marked and retain the reason/replacement reference. Noto Sans supports the bundled
Latin/Greek/Cyrillic coverage; additional scripts need a suitable bundled font.

Primary implementation references: [PDFKit text](https://pdfkit.org/docs/text.html),
[PDFKit buffered pages](https://pdfkit.org/docs/getting_started.html) and
[Mozilla's Node PDF text example](https://github.com/mozilla/pdf.js/blob/master/examples/node/getinfo.mjs).

## Full checks and optional previews

From the repository root, run commands individually and stop on failure:

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

Expected: 74 backend tests (55 existing API, 13 invoice/PDF, six migration), 71
frontend tests, clean lint, successful build and 16 Chromium journeys. Runners
create temporary databases and generated users/products/uploads. Invoice fixtures
are retained until temporary database teardown to exercise deletion protection.
Browser seller defaults and credentials are synthetic and independent of local .env.

The browser run leaves an ignored synthetic eight-page PDF and customer screenshot
under frontend/test-results. With backend development dependencies installed:

~~~powershell
Push-Location backend
try {
    node scripts/render-invoice-preview.js ../frontend/test-results/phase-07-long-invoice.pdf ../frontend/test-results/phase-07-pdf-first-page.png 1
    node scripts/render-invoice-preview.js ../frontend/test-results/phase-07-long-invoice.pdf ../frontend/test-results/phase-07-pdf-last-page.png 8
} finally {
    Pop-Location
}
~~~

The preview helper uses PDF.js and its installed canvas dependency. It writes only
the explicit local output path; previews and test PDFs remain ignored.

## Checkpoint and remaining notes

| Scenario | Verified result |
| --- | --- |
| Repeated/concurrent issuance | Same invoice; one number, one issuance event/audit |
| PDF amounts | Exact stored unit/line/adjustment/total cents, including R0.29 × 3 and maximum supported amounts |
| Product/customer/seller-setting changes | Issued snapshots and parsed PDF text unchanged |
| Customer substitutes invoice ID | 404 for JSON/PDF; no document or foreign billing details in the browser |
| Long orders | Parsed 140-line document and real eight-page browser download, all rows/page references present; previews inspected |
| Issue an unpaid order's invoice | Order/payment/stock state unchanged; no payment confirmation created |
| Correction/void | Original retained, reasoned linked replacement, visible voided PDF and audit history |

No failing Phase 7 checkpoint remains. Runtime npm audit reports zero vulnerabilities.
The two moderate development-only nodemon/minimatch advisories recorded in Phase 6
remain; no forced major-version downgrade was applied. Existing Node/Vite and
Playwright environment warnings are recorded in verification history. Phase 8 has
not been started.
