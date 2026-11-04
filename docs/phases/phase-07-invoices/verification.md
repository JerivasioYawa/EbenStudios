# Phase 07 verification history

## 2026-11-04: Implementation started

**Status:** In progress. **Base:** `fa15c5b9f762dca426d9664c7c9e38f359d6caba`.
**Branch:** `phase/07-invoices`. The initial working tree was clean.

A consistent ignored backup was created before schema edits:
`backend/prisma/backups/phase-07-before-invoices-1793818058242.db`.
Original User/Product/Order/OrderItem/Cart/CartItem/ProductLike/AdminAudit/
StockAdjustment/OrderEvent/PaymentRecord counts were 1/4/0/0/0/0/0/0/0/0/0.
SQLite integrity_check returned ok. The original ordered-record SHA-256 was
`594336df987bf9e9b357333d879b3b24990299bc00ad67697c8ee122237f23d1`.

PDFKit was installed; implementation checks have not yet been marked passed.

## 2026-11-04: Phase 7 checkpoint verified

**Status:** Completed. **Source:** uncommitted working tree on
`phase/07-invoices`, based on `fa15c5b9f762dca426d9664c7c9e38f359d6caba`.
The published phase commit contains the verified implementation, dependency
lockfile, licensed fonts, migration, tests and records together. Earlier phase
branches retain their original snapshots.

### Commands and actual results

| Check actually run | Working directory | Result |
| --- | --- | --- |
| npm.cmd install pdfkit | backend | Installed PDFKit 0.20.2 |
| npm.cmd install --save-dev pdfjs-dist | backend | Installed PDF.js 6.5.438 for independent PDF reading/rendering |
| prisma format / validate | backend | Passed |
| migrate dev --name invoices --create-only | backend | Generated additive draft without applying it |
| Disposable backup copy verifier | backend | Every original row/table definition/sequence preserved; integrity ok |
| migrate dev --name invoices / generate | backend | Reviewed migration applied, client generated; no reset |
| Final prisma migrate status | backend | Eight migrations; database schema up to date |
| DATABASE_URL=file:./test.db; prisma migrate deploy | backend | Invoice migration applied to the separate local test database |
| npm.cmd test, full backend | backend | 74 passed: 55 previous API, 13 invoice/PDF, six migration tests |
| npm.cmd test, frontend | frontend | 71 passed across 16 files |
| npm.cmd run lint | frontend | Passed, no ESLint errors or warnings |
| npm.cmd run build | frontend | Passed; 1,869 modules transformed |
| npm.cmd run test:e2e, complete final run | frontend | All 16 Chromium journeys passed in 1.3 minutes |
| Render synthetic PDF pages 1 and 8 | backend | Both previews generated; eight-page document confirmed and visually inspected |
| npm.cmd audit --omit=dev | backend | Zero runtime dependency vulnerabilities |
| Final development preservation check | backend | All original rows and constraints unchanged; new invoice tables empty; integrity/foreign keys ok |

Tests used generated accounts, products, orders, seller data and private uploads in
temporary databases. No personal admin account or development order was required.
Invoice fixtures remain in their disposable database until teardown because the
new database guards prohibit deleting issued invoices/history. Tests did not create
development invoices or write PDFs to a public folder.

### Numbering, issuance and immutable data

- Four simultaneous issue requests returned one 201 and three 200 responses for
  the same invoice ID/number. A later retry returned that same snapshot despite
  proposed seller edits. Exactly one Issued event and issuance audit existed.
- Numbering uses a transactionally incremented global sequence and UTC-year prefix.
  Database uniqueness, revision/source uniqueness and a partial unique index allow
  one active issued invoice per order. The first audit write acquires SQLite's
  writer lock before reads, so repeat safety works through the database.
- Validated seller and saved billing details, order reference/date, owner, notes,
  lines, currency, total and historical adjustment were copied into the invoice.
  Injected amounts, incomplete addresses, invalid emails and invalid object shapes
  failed before issuance. No current product price or live customer join supplies
  the document's historical fields.
- SQL guards sealed line/total reconciliation and rejected snapshot edits, line
  mutation/insertion after sealing, invoice deletion and history rewriting.
  Draft is only the internal construction state within the transaction; public
  reads do not expose it.
- Product name/price/description, customer name/email and seller environment changes
  left the issued JSON snapshot and independently parsed PDF text unchanged.
- Issuance left Pending payment, Pending order and Unfulfilled fulfilment state
  unchanged. Stock and payment-confirmation counts were unchanged too.

### Private access and download evidence

- Guests received 401 for invoice operations. Customers received 403 for global
  listing/config, issuance, correction and void operations.
- A different customer received 404 for both the JSON ID and PDF URL. Supplying a
  foreign customerId/orderId filter could not reveal records in the own list.
  Expired tokens failed before PDF delivery. Customer JSON omitted internal
  issuer/history email fields.
- Real PDFs used application/pdf, attachment filename, private/no-store, no-cache,
  Vary: Authorization and nosniff headers. CORS exposed Content-Disposition for
  the browser's invoice-number filename. The upload directory stayed unchanged
  and public `/uploads/<invoice number>.pdf` returned 404.
- Frontend service assertions verified bearer-session blob requests, download names,
  object URL cleanup, guest rejection, JSON-blob error handling and suppression of
  a PDF response from the previous account after a session switch.
- The browser issued/corrected an invoice as admin, then logged in as its customer
  and downloaded the replacement through the actual customer page. A second
  customer opened the first customer's invoice URL and saw Invoice not found,
  without a download action or foreign billing address.

### PDF amounts, pagination and visual review

Independent PDF.js parsing established:

- Three 29-cent units printed unit R0.29, line/subtotal R0.87; a saved -1-cent
  historical adjustment printed -R0.01 and invoice total R0.86, matching the order.
- Accented text such as Zoë Mokoena remained readable and extractable.
- The maximum supported 2,147,483,647-unit / 2,147,483,647-cent example printed
  complete numbers and total R21,474,836.47 without float artifacts or page overflow.
- A 140-line invoice with a long description and an unbroken long token retained
  every named line, page number and exact R296.10 total. Text coordinates stayed
  inside the page boundaries on every page.
- The real browser assembled a 25-product order with long descriptions and downloaded
  eight pages. Every product was present in the description column, all page
  references were correct and the total was R21.75. After voiding, the retained PDF
  displayed VOIDED INVOICE and still showed the same complete amounts.

The ignored synthetic PDF is
`frontend/test-results/phase-07-long-invoice.pdf`. Pages 1 and 8 were rendered using
the preview helper and inspected alongside the customer invoice screenshot.
The review confirmed readable column spacing, wrapped descriptions, continued-item
labels, repeated table headings/page references and a clear final total. The customer
view retains the current application layout and links the original/replacement.

PDFKit uses bundled unmodified Noto Sans Regular/Bold rather than operating-system
fonts. Their official source commit, SHA-256 hashes and SIL Open Font License are
recorded in [the font manifest](../../../backend/assets/fonts/README.md). This bundle
covers Latin/Greek/Cyrillic; further scripts require a suitable font asset.

### Correction, void and cancellation evidence

- Three concurrent matching correction calls produced one 201 and two 200 responses
  for the same new revision/number. Original billing/line/amount snapshots remained
  retained; the original became Voided and linked to the replacement. A conflicting
  retry received 409. Issuing the order again returned the latest replacement.
- Corrections copied financial lines/amounts from the original invoice. Seller,
  billing or notes changes require a recorded reason and a linked replacement,
  rather than editing issued data. Each actual replacement has its own issuance audit.
- Missing void reason failed. Matching void retries returned the existing voided
  snapshot; conflicting reasons failed. A later issue call could not silently
  replace a voided document. Its PDF remained available with a visible void mark.
- Order cancellation voided the active invoice with actor/reason/time in the same
  stock/status/audit transaction. A cancellation retry did not add another void
  event. Cancelled orders could not receive first-time or replacement invoices.
- Invoice actions never inserted a payment-confirmation record or marked the
  order paid. The browser also verified Pending payment after issuance and void.

### Failures found and resolved

1. The initial PDF test reader called destroy on the document object, which this
   installed PDF.js version does not expose. Cleanup now destroys the loading task;
   all actual PDF assertions then passed.
2. Browser label lookup was ambiguous for a prefilled textarea nested in its label.
   Invoice fields now have explicit unique IDs and label associations. Issuance and
   correction browser interactions passed after that change.
3. Cross-origin download review added exposure of the attachment filename header.
   Real browser downloads used the invoice-number filename with bearer authentication.
4. Initial browser PDF assertions assumed literal single spaces and flat reading
   order across wrapped table rows. Assertions now recognize PDF text whitespace and
   read the description column separately from quantity/amount runs. No product
   data or totals were missing. Both focused journeys then passed, followed by the
   full 16-journey regression run with no unexpected application console/page errors.

### Migration and development preservation

The reviewed migration adds only the four invoice tables/indexes and SQL guards
inside one transaction. It does not backfill documents or recalculate existing
money, payments, stock or history. A populated pre-invoice fixture included all
11 earlier business models, a paid order, a payment reference, stock/audit/history
records and raised sequence marks. Every original field and table definition
remained identical; all new invoice tables started empty.

The real consistent pre-invoice backup remains local and ignored:
`backend/prisma/backups/phase-07-before-invoices-1793818058242.db`.
Before and after counts were:

| Model | Before | After |
| --- | --- | --- |
| User | 1 | 1 |
| Product | 4 | 4 |
| Order / OrderItem / Cart / CartItem / ProductLike | 0 each | 0 each |
| AdminAudit / StockAdjustment / OrderEvent / PaymentRecord | 0 each | 0 each |

The original ordered-record digest is recorded in the starting entry. The copy
verifier compared canonical hashes of complete original records and exact SQLite
table definitions, without dumping private records/password hashes. Both the real
disposable copy and final development database passed, including integrity,
foreign-key and sequence checks. All invoice tables and numbering state remained
empty in development. No reset was proposed or accepted.

### Environment, remaining notes and publication

Verified on Windows/PowerShell, Node 26.12.0, npm 11.20.0, Prisma 5.22.0, PDFKit
0.20.2, PDF.js 6.5.438, Vite 8.3.5, Vitest 5.1.0 and Playwright 1.64.1/Chromium.
Required process-based checks used the approved sandbox permissions. Existing
Node module.register deprecation, color-environment and Vitest environment-cost
messages did not prevent checks passing. Expected 404/409 rejection assertions
produce server logs; they are not remaining failures.

Runtime dependency audit is clean. The two moderate development-only
nodemon/minimatch advisories carried from Phase 6 remain documented; the suggested
forced major-version downgrade was not applied. Seller details must be entered
before real issuance. No real seller registration data, credentials, invoice PDFs
or database contents are committed. No Phase 7 checkpoint remains failing and
Phase 8 has not been started.

The final source and these records are committed together on
[`phase/07-invoices`](https://github.com/JerivasioYawa/EbenStudios/tree/phase/07-invoices).
The standing workflow pushes that phase branch with upstream tracking and verifies
its remote SHA against the local commit. Earlier published phase history is retained.
