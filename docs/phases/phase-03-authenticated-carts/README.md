# Phase 03: Require login before adding to cart

**Status:** Completed. **Last verified:** 2026-11-04, Africa/Johannesburg.

Customers must authenticate before changing a cart. The product action preserves
its full internal URL through login or registration. Cart and checkout routes
require an authenticated user, and cart contents are persisted per account in
SQLite. Expired authenticated API calls clear the active session and request login.

## Relevant files

| File | Responsibility |
| --- | --- |
| [Prisma schema](../../../backend/prisma/schema.prisma) | Cart and CartItem relations |
| [Cart migration](../../../backend/prisma/migrations/20261104150434_authenticated_carts/migration.sql) | Additive tables, ownership uniqueness, foreign keys, and indexes |
| [Cart routes](../../../backend/src/routes/cart.routes.js) | Authenticated cart read, add, update, remove, and clear |
| [Cart helpers](../../../backend/src/lib/cart.js) | Positive integer validation and current product data in cart responses |
| [Authentication middleware](../../../backend/src/middleware/auth.js) | Verifies the JWT and loads the current user and role from the database |
| [Order routes](../../../backend/src/routes/order.routes.js) | Checkout from the user's saved cart, current prices, atomic stock decrement, and cart clearing |
| [Express app](../../../backend/src/app.js) | Mounts the cart API |
| [Session helpers](../../../frontend/src/service/session.js), [API client](../../../frontend/src/service/api.js) | Central 401 handling and protection against stale requests after account changes |
| [Auth provider](../../../frontend/src/context/AuthContext.jsx) | Session restoration, login/logout, cross-tab changes, and session identity |
| [Cart provider](../../../frontend/src/context/CartContext.jsx), [cart service](../../../frontend/src/service/cartService.js) | Account-specific state and authenticated asynchronous mutations |
| [Product page](../../../frontend/src/pages/ProductPage.jsx) | Guest login action and saved-cart add feedback |
| [Login](../../../frontend/src/pages/Login.jsx), [registration](../../../frontend/src/pages/Register.jsx), [return URL helper](../../../frontend/src/lib/loginReturn.js) | Safe internal return destination, including query and hash |
| [Protected route](../../../frontend/src/routes/ProtectedRoute.jsx), [routes](../../../frontend/src/routes/AppRoutes.jsx) | Protect cart and checkout while waiting for authentication |
| [Session boundary](../../../frontend/src/routes/SessionBoundary.jsx), [App](../../../frontend/src/App.jsx) | Redirect expired sessions to login with a clear message |
| [Cart page](../../../frontend/src/pages/Cart.jsx), [checkout](../../../frontend/src/pages/Checkout.jsx) | Loading/error states, awaited mutations, and saved-cart checkout |
| [API tests](../../../backend/test/api.test.js) | Guest access, ownership, quantities, stock, prices, expiry, and checkout rollback |
| [Cart context tests](../../../frontend/src/context/CartContext.test.jsx), [cart UI tests](../../../frontend/src/pages/Cart.test.jsx) | Missing/loading authentication, persistence, logout, and stale response protection |
| [Protected route tests](../../../frontend/src/routes/ProtectedRoute.test.jsx), [return URL tests](../../../frontend/src/lib/loginReturn.test.js), [API client tests](../../../frontend/src/service/api.test.js) | Route access, safe destinations, central expiry, and account change races |
| [New browser journeys](../../../frontend/e2e/authenticated-cart.spec.js), [customer journeys](../../../frontend/e2e/customer.spec.js), [admin journeys](../../../frontend/e2e/admin.spec.js) | Complete customer/admin flows using saved carts |

## Prerequisites

Start at the repository root. Reuse [Phase 01](../phase-01-local-setup/README.md)
for local environment configuration and [Phase 02](../phase-02-test-setup/README.md)
for dependency and Chromium installation. On a new checkout, install backend and
frontend dependencies with their lockfiles before generating Prisma Client.

The existing JWT login is retained. No new service credentials are required.
Real credentials remain in ignored environment files; tests generate their own
users and credentials.

## Database migration

The original implementation ran these commands from backend, in order:

    npx.cmd prisma format
    npx.cmd prisma validate
    npx.cmd prisma migrate dev --name authenticated_carts
    npx.cmd prisma generate

The generated migration is 20261104150434_authenticated_carts. It adds Cart and
CartItem without modifying or recreating the existing business tables.
Cart.userId is unique. CartItem has a unique (cartId, productId) pair.
Cart items are removed when their cart or product is deleted.

For repeat setup, apply the existing migration and regenerate the client rather
than creating another migration:

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

Expected result: four migrations applied or already applied, a generated Prisma
Client, and an up-to-date database schema. Run each command separately and stop
on a nonzero exit code. Never accept a reset of a useful database; resolve drift
or migration conflicts first.

Before the original migration, a consistent SQLite backup was created using
VACUUM INTO under the ignored backend/prisma/backups/ directory. The existing
business records were compared before and after migration and testing; they
were unchanged. See [verification.md](verification.md).

## Cart API contract

All paths below are relative to /api and require Authorization: Bearer TOKEN.

| Method | Path | Body | Behavior |
| --- | --- | --- | --- |
| GET | /cart | None | Read this user's cart; an empty read does not create database records |
| POST | /cart/items | productId and quantity as positive integers | Add quantity to the product already in this user's cart, or create its entry |
| PATCH | /cart/items/:productId | quantity as a positive integer | Set the absolute quantity of an existing entry |
| DELETE | /cart/items/:productId | None | Remove this user's product entry |
| DELETE | /cart | None | Clear this user's saved cart |
| POST | /orders | Optional shippingAddress | Checkout only this user's saved cart |

Cart operations return an object containing an items array. Each item contains
current product fields and the saved quantity. IDs and quantities must be positive
integers within Prisma's 32-bit Int range. Quantity zero is not an update command;
use DELETE to remove a product.

The server obtains ownership from the verified session's user ID. Client-supplied
userId and cartId values cannot select another user's cart. The API never relies
on a supplied cart ID as proof of ownership. Unauthenticated, expired, malformed,
or deleted-user sessions receive 401 before cart writes.

Adding and updating check the total saved quantity against available stock.
They do not decrement stock or reserve items. Checkout rereads the saved cart,
validates its quantities, uses current database prices, and conditionally decrements
available stock inside one transaction. Insufficient stock rolls back every
decrement and leaves the cart intact. A successful checkout creates the order and
clears that user's cart items in the same transaction.

Checkout no longer trusts a submitted items list, total, price, userId, or cartId.
Callers should first save items through the cart API, then submit shippingAddress
to /orders. Direct API fixtures in the admin browser journey were updated accordingly.

## Frontend behavior and session handling

- Guests see “Log in to add to cart.” Clicking it opens login and saves the full
  product path, query, and hash. Login returns to the product without auto-adding.
- Cart and checkout redirect guests to login. Protected content waits while
  authentication is being restored.
- Cart mutations reject when authentication is absent or still loading. Controls
  also wait for initial cart loading and pending mutations.
- Logout clears active cart items and totals immediately. Saved database carts
  remain account-specific and are restored on that account's next login.
- Legacy shared eben_cart_items browser data is removed by session setup/clearing
  and is never imported into a customer's saved cart.
- Account/session changes reset only cart state, preserving page-local feedback.
  Late fetch or mutation responses cannot populate another account's active cart.
- A central Axios interceptor handles authenticated 401 responses, clears the
  session, and displays “Your session has expired. Please log in again.” on login.
  Ordinary failed public login requests do not expire another active session.
- Queued requests from an old account are rejected before sending with a new
  account's token. Late 401s from old tokens do not sign out a newly logged-in user.
- Cross-tab token changes recheck authentication and reset active cart state.

## Rerun the checkpoint

The normal API suite creates and migrates its own temporary database. The browser
backend independently does the same. Both are isolated from local development data.

~~~powershell
npm.cmd --prefix backend test
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run test:e2e
~~~

The explicitly requested manual test.db preparation was also run successfully.
To repeat that preparation, preserve and restore any pre-existing shell variable:

~~~powershell
Push-Location backend
$previousDatabaseUrl = $env:DATABASE_URL
try {
    $env:DATABASE_URL = 'file:./test.db'
    if (!(Test-Path -LiteralPath prisma/test.db)) {
        New-Item prisma/test.db -ItemType File | Out-Null
    }
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
~~~

The API runner still overrides this URL with a unique disposable database during
its tests. The manual test.db file verifies migration deployment separately; it
does not become the development database.

## Expected outcomes and checkpoint

| Scenario | Verified result |
| --- | --- |
| Guest clicks the cart action | Login opens; no cart mutation is sent; login preserves the product URL |
| Guest visits /cart or /checkout directly | Redirected to login |
| Guest calls a cart API | 401; no cart or item is saved |
| Customer adds an available item | Correct product, quantity, and account ownership are saved |
| A logs out; B logs in | Active A state is cleared; B sees only B's cart; A can later restore A's cart |
| Session expires | The real API returns 401, the action saves nothing, and login shows the expiry message |

- [x] All eight requested code changes implemented.
- [x] Positive integer validation, owner-scoped API access, and checkout revalidation tested.
- [x] Additive migration applied without resetting the useful development database.
- [x] Existing users, products, orders, and order items preserved.
- [x] 25 API tests passed.
- [x] 28 frontend tests passed across six files.
- [x] Eight Chromium journeys passed.
- [x] Lint and production build passed.

Reports remain under the ignored frontend/playwright-report/ and
frontend/test-results/ directories. Port overrides and report viewing are described
in [TESTING.md](../../../TESTING.md). See [verification.md](verification.md) for the
actual execution history, the fixed browser regression, and remaining warnings.
