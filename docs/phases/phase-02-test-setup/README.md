# Phase 02: Test setup and initial frontend checks

**Status:** Completed. **Last verified:** 2026-11-04.

This phase separates the Express application from its listener, adds API and
component tests, configures Chromium browser journeys, and verifies test database
isolation plus frontend lint and production build.

## Implementation references

| File or directory | Responsibility |
| --- | --- |
| [backend/src/app.js](../../../backend/src/app.js) | Exports the configured app without listening on a network port |
| [backend/src/index.js](../../../backend/src/index.js) | Loads environment configuration and starts the app |
| [backend/test/api.test.js](../../../backend/test/api.test.js) | Node test runner and Supertest API assertions with fresh fixtures |
| [backend/test-support/database.js](../../../backend/test-support/database.js) | Creates a temporary SQLite database, applies migrations, and safely cleans it up |
| [frontend/vitest.config.js](../../../frontend/vitest.config.js) | React, jsdom, setup file, and collection restricted to `src/` |
| [frontend/src/test/setup.js](../../../frontend/src/test/setup.js) | jest-dom matchers, DOM cleanup, and storage resets |
| [Cart.test.jsx](../../../frontend/src/pages/Cart.test.jsx) | Cart totals, persistence, removal, and corrupt-storage coverage |
| [AdminRoute.test.jsx](../../../frontend/src/routes/AdminRoute.test.jsx) | Guest, customer, admin, and loading-state access checks |
| [frontend/playwright.config.js](../../../frontend/playwright.config.js) | Chromium, local application URLs, test credentials, and both server startup commands |
| [Customer browser tests](../../../frontend/e2e/customer.spec.js) | Registration, login, shop, checkout, order history, and access restrictions |
| [Admin browser tests](../../../frontend/e2e/admin.spec.js) | Product image upload, editing, deletion, and order fulfilment |
| [Browser fixtures](../../../frontend/e2e/support/fixtures.js) | Independent customer credentials and local placeholder-image responses |
| [Browser API startup](../../../frontend/e2e/support/start-api.js) | Migrates and seeds a separate database before loading the app |
| [Browser teardown](../../../frontend/e2e/support/teardown.js) | Requests authenticated test-server cleanup |
| [Frontend ESLint configuration](../../../frontend/eslint.config.js) | Node globals for configuration/support files and report-directory exclusions |
| [Backend package.json](../../../backend/package.json), [frontend package.json](../../../frontend/package.json) | Test scripts and development dependencies |

## Prerequisites

Use the shared environment instructions in the [phase index](../README.md).
On a new machine, install dependencies, generate the Prisma Client, and install Chromium:

```powershell
npm.cmd --prefix backend ci
Push-Location backend
try {
    npx.cmd prisma generate
} finally {
    Pop-Location
}
npm.cmd --prefix frontend ci
Push-Location frontend
try {
    npx.cmd playwright install chromium
} finally {
    Pop-Location
}
```

The tests create their own credentials and databases. They do not require a
personal admin account or a seeded development database. The seed script is used
by the browser test server with test-specific environment credentials.

## Rerun the complete checkpoint

Run each command from the repository root and check that it exits successfully:

```powershell
npm.cmd --prefix backend test
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run test:e2e
```

| Command | Expected outcome for the recorded implementation |
| --- | --- |
| Backend `npm test` | 14 API tests pass |
| Frontend `npm run lint` | Exit code 0 |
| Frontend `npm test` | Two test files, eight component tests pass; no `e2e/` specs collected |
| Frontend `npm run build` | Exit code 0; production output written under ignored `frontend/dist/` |
| Frontend `npm run test:e2e` | Five Chromium journeys pass, including opening the shop |

Test counts can increase in later phases. Record changed counts in a new verification entry.

## Database isolation and fixtures

Both API tests and the browser-test backend call `createTestDatabase()`. Each call
creates an `eben-studios-test-*` directory in the operating system's temp folder,
creates its SQLite file, and applies the committed migrations using an explicit
test `DATABASE_URL`. The application and Prisma singleton are imported only after
that test URL is configured. The working directory is also isolated so uploads
go into the temporary directory.

API tests create a known admin, customer, and `Test Hoodie` fixture before each test.
The browser backend seeds its own four starter products and uses the generated
test admin credentials passed by Playwright. Browser customers use unique emails
and generated passwords. Test state does not depend on personal account data.

Preparation is automatic. Manually setting `DATABASE_URL=file:./test.db` is
unnecessary for these runners: they replace it with their own temporary database
URL, then restore the original environment where applicable.

API teardown disconnects Prisma and removes its temporary directory. Browser
teardown uses an authenticated endpoint that exists only in the test server to
disconnect Prisma and remove the browser database and uploads. Abruptly killing
the runner can leave a temporary directory in the OS temp folder.

## Ports and browser reports

The test API uses `http://127.0.0.1:4100`; the frontend uses
`http://127.0.0.1:4173`. The frontend receives the test API URL through its process
environment. Existing development servers are not reused.

If a test port is occupied, override it for this PowerShell session and restore
the previous values afterward:

```powershell
$previousFrontendPort = $env:E2E_PORT
$previousApiPort = $env:E2E_API_PORT
try {
    $env:E2E_PORT = '4273'
    $env:E2E_API_PORT = '4200'
    npm.cmd --prefix frontend run test:e2e
} finally {
    if ($null -eq $previousFrontendPort) { Remove-Item Env:E2E_PORT -ErrorAction SilentlyContinue }
    else { $env:E2E_PORT = $previousFrontendPort }
    if ($null -eq $previousApiPort) { Remove-Item Env:E2E_API_PORT -ErrorAction SilentlyContinue }
    else { $env:E2E_API_PORT = $previousApiPort }
}
```

Run headed tests with `npm.cmd --prefix frontend run test:e2e -- --headed`.
Failure screenshots and traces are written to `frontend/test-results/`; the HTML
report is in `frontend/playwright-report/`. Both directories are ignored by Git.
To view the report:

```powershell
Push-Location frontend
try {
    npx.cmd playwright show-report
} finally {
    Pop-Location
}
```

## Checkpoint

- [x] Tests execute real assertions.
- [x] Vitest excludes Playwright specs through its `src/` collection rule.
- [x] API tests and the browser backend use separate temporary databases.
- [x] Fixtures are created by the test setup and do not use a personal admin account.
- [x] Development products and orders remain unchanged.
- [x] Frontend lint, component tests, and production build pass.
- [x] A Chromium journey opens the shop and completes checkout.
- [x] Admin product management and order fulfilment journeys pass.

See [verification.md](verification.md) for actual results, the development database
checksum comparison, and resolved issues. [TESTING.md](../../../TESTING.md) remains
the shorter command reference.
