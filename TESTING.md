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
inventory rollback, order privacy, and order status changes. Each run applies
the committed migrations to its own temporary SQLite database and removes it
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
totals, persistence, removal and corrupt storage, plus admin route access.
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
