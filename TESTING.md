# Running the tests

Completed phase guides and checkpoint history are archived in
[docs/phases](docs/phases/README.md).

Run these commands from the repository root in PowerShell. On systems that block
PowerShell npm scripts, use `npm.cmd` and `npx.cmd` in place of `npm` and `npx`.

## First-time setup

```powershell
Set-Location backend
npm ci
npx prisma generate
Set-Location ../frontend
npm ci
npx playwright install chromium
Set-Location ..
```

## API tests

```powershell
Set-Location backend
npm test
Set-Location ..
```

Node's test runner and Supertest exercise the exported Express app, including
authentication, role permissions, catalogue and image uploads, checkout,
inventory rollback, order privacy, and order status changes. Authenticated cart
coverage includes ownership, positive integer quantities, stock availability,
expired sessions, and checkout from saved cart contents using current prices.
Likes coverage includes authenticated ownership, repeated and concurrent requests,
unique pairs, deleted products/users, and unchanged cart/stock snapshots.
Order integrity coverage adds integer-cent calculations, full checkout rollback,
last-unit contention through HTTP and independent Prisma clients, account-scoped
retry keys, immutable customer/product snapshots and historical product deletion.
Migration tests build the old schema with historical orders/carts/likes, verify
conversion and sequence preservation, and prove invalid legacy data aborts without
losing business records. They use Node's built-in node:sqlite DatabaseSync API.
Admin management assertions also cover every admin endpoint's role checks,
search/filter pagination, archive/restore, reasoned stock changes, image decoding
and cleanup, payment evidence, enforced fulfilment transitions, concurrent
cancellation, stock rollback and dashboard payment/refund aggregates. The admin
migration test preserves original records and CHECK constraints while marking
legacy payment labels Unverified instead of inventing receipts.
Each run applies the committed migrations to its own temporary SQLite database and removes it
afterward. Uploads are temporary too. The app module does not open a listener;
Supertest manages its own temporary server.

## Component tests

```powershell
Set-Location frontend
npm test
# Or: npm run test:watch
Set-Location ..
```

Vitest uses React, jsdom, Testing Library, and jest-dom. The tests cover cart
totals, persistence, removal, legacy storage isolation, protected routes, safe
login return URLs, account changes, and central expired-session handling.
Likes tests also cover local guest persistence, keyboard hearts outside links,
storage errors, one merge job during Strict Mode replay, acknowledged merge retry,
and old-account response suppression.
Money and checkout tests cover exact two-decimal totals, large aggregate values,
persisted retry keys, failed responses, cart changes, account isolation and request headers.
Admin interface tests cover filters/pages, stock-safe product editing, optional
field clearing, required reasons, server rejection messages, payment controls,
pending-input disabling, stale search suppression and server-provided financial totals.
DOM cleanup and storage resets run after each test. Only tests under `src/`
are collected by Vitest, so Playwright specs are kept separate.

## Browser journeys

```powershell
Set-Location frontend
npm run test:e2e
# Optional: npm run test:e2e -- --headed
Set-Location ..
```

Playwright starts its own API on `http://127.0.0.1:4100` and frontend on
`http://127.0.0.1:4173`, then runs Chromium. It creates and migrates a temporary
database and runs the seed with generated test credentials. Local `.env`
credentials and the working database are not used. Existing development
servers are not reused. A test-only authenticated shutdown endpoint disconnects
Prisma and removes the temporary database and uploads during teardown.

The customer journeys cover registration, login, cart persistence, checkout,
order history, failed login, and protected routes. The admin journeys cover
login, product creation with an image, editing, deletion, and updating an order
status that the customer can then see. API requests use the real test server;
only external placeholder images are fulfilled locally.

The authenticated-cart journeys also check guest login redirects, full product
URL restoration, guest API rejection, persistent carts separated by account,
logout clearing, and a real expired-session cart API failure followed by login.
Likes journeys cover guest refresh persistence, mouse/keyboard controls, merging
guest preferences exactly once after login, account likes in an independent
browser context, and unchanged cart/stock data.
The order-integrity journey submits three R0.29 items, lets the real API commit,
discards the receipt, then verifies that retrying returns the same R0.87 order.
It checks stock and cart state and verifies history after product edits/deletion.
Admin journeys also search/page products, archive/restore, inspect stock history,
confirm full payments, process/ship orders, cancel with once-only stock restoration,
record a processed refund and check the dashboard against API totals. Browser
page errors and unexpected application console errors are checked for these flows.
After Phase 6, the expected totals are 60 backend tests (55 API and 5 migration),
60 frontend tests, and 14 Chromium journeys. The
[Phase 6 record](docs/phases/phase-06-admin-management/README.md) contains management
contracts, migration/backfill policy, disposable-copy verification and checkpoint evidence.

Set `E2E_PORT` or `E2E_API_PORT` to use different local ports:

```powershell
$env:E2E_PORT = '4273'
$env:E2E_API_PORT = '4200'
npm run test:e2e
```

Screenshots and traces are saved for failures. View the HTML report with
`npx playwright show-report` from `frontend`. Reports and results are ignored
by Git. Abruptly terminating the runner can leave a temporary test directory
in the operating system's temp folder.

Configuration references: [Playwright test servers](https://playwright.dev/docs/test-webserver),
[Vitest setup files](https://vitest.dev/config/setupfiles), and
[Testing Library setup](https://testing-library.com/docs/react-testing-library/setup/).
