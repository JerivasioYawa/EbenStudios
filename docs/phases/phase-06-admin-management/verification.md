# Phase 06 verification history

## 2026-11-04: Implementation started

**Status:** In progress. **Base:** `c61fd1102ed7459f4ab5dd92f61fcf523e964b60`.
**Branch:** `phase/06-admin-management`. The starting working tree was clean.

A consistent ignored VACUUM INTO backup was created before schema edits:
`backend/prisma/backups/phase-06-before-admin-management-1793814210573.db`.
Original model counts (User, Product, Order, OrderItem, Cart, CartItem, ProductLike)
were 1, 4, 0, 0, 0, 0, 0. SQLite integrity_check returned ok.
The ordered original-record SHA-256 was
`38a325a69a1e4688962b589bbca853e896b243c524c9419a6b3c91573ef16aea`.

No Phase 6 checkpoint has been marked passed yet.

## 2026-11-04: Phase 6 checkpoint verified

**Status:** Completed. **Verification source:** uncommitted working tree on
`phase/06-admin-management`, based on `c61fd1102ed7459f4ab5dd92f61fcf523e964b60`.
The final phase commit includes source, dependency lockfile, migration, assertions
and records together. The base commit alone does not contain Phase 6.

### Commands and actual results

| Check actually run | Working directory | Result |
| --- | --- | --- |
| prisma format / validate | backend | Passed |
| migrate dev --name admin_management --create-only | backend | Generated draft for review without applying it |
| Disposable real-data copy verification | backend | All original fields/relationships/sequences retained; integrity ok |
| migrate dev --name admin_management / generate | backend | Reviewed migration applied; client generated; no reset |
| prisma migrate status | backend | Seven migrations; schema up to date |
| DATABASE_URL=file:./test.db; prisma migrate deploy | backend | Admin migration applied to separate local test.db |
| npm.cmd test, full backend | backend | 60 passed: 55 API, four Phase 5 migration tests, one populated Phase 6 migration test |
| npm.cmd test, frontend | frontend | 60 passed across 14 test files |
| npm.cmd run lint | frontend | Passed, no ESLint errors or warnings |
| npm.cmd run build | frontend | Passed, 1,864 modules transformed |
| npm.cmd run test:e2e, complete corrected run | frontend | All 14 Chromium journeys passed in 55.0 seconds |
| npm.cmd audit --omit=dev | backend | Zero runtime dependency vulnerabilities |
| Final development record comparison | backend | All original business fields retained; integrity ok, foreign keys valid |

All API/browser users, products, orders, images and databases came from disposable
fixtures. Personal admin credentials and development products/orders were not used
as test prerequisites. Environment files, databases, backups and reports remain ignored.

### Product-management evidence

- Admin creation trims/validates product fields, saves cent prices and thresholds,
  records the initial stock with the verified actor, and creates an audit snapshot.
  Blank/oversized/wrong-type text, invalid amounts/stock/thresholds and missing price
  fail without product or audit changes. Optional text can be cleared by the editor.
- Product searches/filter combinations and page bounds execute on the server.
  Assertions exercised 12 matching products across pages, low/out/active/archive
  filtering and invalid query rejection. The real browser searched, paged, filtered,
  archived, restored and adjusted a selected product through the existing UI.
- Archiving removed public catalogue/detail access and blocked cart adds/updates
  plus checkout from a cart saved before archive. No stock was consumed. Restore
  made it purchasable again; snapshots and relationships stayed intact.
  Archive coverage also verifies that likes can still be acknowledged for login
  merging, stay hidden while archived and reappear after restore.
- Concurrent signed stock adjustments both committed accurately. Invalid/missing
  reasons, zero/fractional/string deltas and stock underflow failed without a ledger
  or audit write. Actor ID/name/email, reason, time, delta and before/after stock
  were verified. The earlier PUT product path requires a stock reason too.
- The editor omits stock on product edits, so description/price changes cannot
  overwrite a customer's concurrent purchase. The browser created/edited an image
  product, adjusted stock with a reason, reloaded persisted values, then opened
  that product in the public shop before deletion.
- Hard deletion of an ordered product now receives 409 and requests archive.
  The Phase 5 historical-order journey was updated to verify this stronger policy.
  Earlier phase branches still preserve their original deletion behavior.

### Validated image lifecycle

The old tiny PNG fixture failed actual decoding. It was replaced with a valid
generated two-pixel PNG; production validation was not weakened to accept it.
Sharp decodes pixels rather than trusting MIME/extension or metadata alone.

API assertions rejected fake content, truncated PNG, disguised SVG, MIME mismatch,
an oversized upload and a valid image attached to a failing duplicate-product save.
File listings stayed unchanged after rejected saves. A failed replacement also
kept the current image accessible. Successful unused-image replacement removed
the old file; an image saved in an order snapshot remained accessible after product
image replacement. Multipart buffering created no files before validation.

Limits are 5 MB and 20 million input pixels, with normalized first-frame PNG output
up to 1600×1600. Metadata is discarded and generated filenames stay inside the
managed upload directory. See the primary
[Sharp constructor documentation](https://sharp.pixelplumbing.com/api-constructor/).

### Order, stock and payment evidence

- Guests received 401 and customers 403 on every admin read/write route, including
  dashboard, history, audit, stock, archive, payment, refund and shipping endpoints.
  Submitted foreign actor IDs did not affect audit ownership.
- Admin order pages returned filtered/paginated records and full details with saved
  customer/address/items, references, payment records and chronological actor history.
- Invalid transitions were rejected with 409 before any order/payment/history/stock
  change. The old status endpoint cannot bypass the sequence or mark Paid without
  a referenced payment. Fulfilment requires confirmed payment; shipping requires
  a reference. The browser confirmed a payment, processed an order, shipped it and
  verified the customer's persisted shipping state.
- Four concurrent cancellations plus a later retry restored inventory once, with
  one cancellation event and one restoration ledger entry. Archived products were
  restored safely too. A terminal imported cancellation with unknown restoration
  time also remained a no-op. Cancellation after shipping was rejected.
- A deliberately unsafe later restoration rolled back the earlier restoration,
  provisional audit, status and all stock records. Deleted legacy product references
  and overflow receive a review error instead of a partial cancellation.
- Payment amount/reference validation, global reference uniqueness and per-order
  kind uniqueness prevented duplicate/conflicting evidence. Concurrent identical
  confirmation calls created one payment and one payment-history event.
- Dashboard pending-order values stayed excluded. Confirming a 20,000-cent payment
  added exactly that amount; cancelling removed it from confirmed totals and moved
  it to awaiting refund. Recording/retrying the processed refund counted it once,
  without restoring stock again. Totals use BigInt and string cents across the API.
- The real browser independently exercised a 2,000-cent order, rejected a delivery
  jump, confirmed payment, processed/cancelled it, retried cancellation, checked stock,
  recorded a refund and compared dashboard/API values. Customer history remained
  Cancelled/Refunded with the original item and amount. This records manual evidence;
  no card charge or refund transfer is performed by these endpoints.

### Browser and frontend issues fixed

The initial complete browser run passed 13 journeys and found a form timing issue
in the cancellation flow: text could be typed into the previous status form while
the preceding transition was refreshing, then cleared on remount. Order controls
now disable the entire fieldset while a mutation is pending. A dedicated frontend
assertion verifies that input protection, and the browser waits for the acknowledged
Processing state before submitting cancellation.

A React development warning also identified an internal query key being spread
as component props. The shared hook now returns only data/error/loading. The two
affected management journeys passed after both fixes, with no unexpected browser
application console errors or page errors; the full suite then passed all 14.
Frontend assertions also cover stale-response abortion, server failure display,
payment gating, required reasons, stock-safe editing and financial aggregate display.

Success screenshots of product/stock history and cancelled/refunded order details
were captured under ignored frontend/test-results and inspected. Both retain the
existing sidebar/header/admin layout. Expected API rejection tests produce 404/409
server logs; these are deliberate assertions, not outstanding application failures.

### Migration preservation and historical policy

The generated draft rebuilt Product/Order and would drop the custom Phase 5 CHECK
constraints and sequence high-water marks. It was replaced before application
with additive ALTER TABLE statements, new tables/indexes and explicit backfill
inside one transaction. No original business table was dropped.

The populated migration fixture covered all legacy statuses, saved item names and
cent amounts, cart/like relationships and raised sequence marks. Every original
field survived. Paid/Shipped/Delivered payment labels became Unverified without
fabricated receipts. Shipped/Delivered/Cancelled fulfilment states were retained,
import history was added, and inventory stayed unchanged. Original price/stock,
quantity and total CHECK constraints remained enforced, as did the new threshold guard.

Final review left unknown imported restoration timestamps null. Terminal Cancelled
orders already reject further fulfilment and treat repeated cancellation as a no-op;
there is no need to invent a restoration date. This refinement touched only the new,
unpublished migration. Both local databases were checked to contain no orders before
its guarded checksum metadata update; no business data changed. The exact final SQL
passed the disposable-copy verifier and populated migration suite again.

The real pre-migration backup remains ignored:
`backend/prisma/backups/phase-06-before-admin-management-1793814210573.db`.
User/Product/Order/OrderItem/Cart/CartItem/ProductLike counts remained 1/4/0/0/0/0/0.
The canonical hash comparison projected all original fields to account for newly
added columns. The real database had no historical orders; the populated fixture
establishes the backfill behavior independently. Integrity and foreign-key checks
passed for the real disposable copy and development database after implementation.
The earlier Phase 5 verifier was also rerun successfully using its frozen boundary.

### Dependency and environment notes

Sharp 0.35.5 was added for real image decoding. The initial npm install reported
seven advisories, including runtime HTTP/upload packages. Compatible npm audit fix
patches and Multer's minimum 2.5.0 resolved the runtime issues. Its exit code was 1
because two moderate development-only nodemon/minimatch advisories remain.
The suggested force fix would downgrade nodemon to 1.0.2 across major versions;
it was not applied. Runtime-only audit subsequently returned zero vulnerabilities.

Verified on Windows/PowerShell with Node 26.12.0, npm 11.20.0, Prisma 5.22.0,
Vite 8.3.5, Vitest 5.1.0 and Playwright 1.64.1/Chromium. Process-based checks ran
with the required sandbox permissions. Existing Node module.register deprecation
and Playwright color warnings did not prevent successful checks.

### Publication and remaining work

All Phase 6 checkpoints passed. The only recorded dependency follow-up is the
development-only advisory above. Manual payment/refund records require independent
verification by the admin; this phase does not integrate a payment gateway.
No Phase 7 work has been started.

The verified source, migration, tests and records are committed together on
[`phase/06-admin-management`](https://github.com/JerivasioYawa/EbenStudios/tree/phase/06-admin-management),
stacked on Phase 5. The standing workflow pushes this branch with upstream tracking
and checks the remote SHA against the local commit. Private environment files,
databases, uploads, dependency folders and generated reports/builds are excluded.
