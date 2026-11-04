# Phase 04: Product likes

**Status:** Completed. **Last verified:** 2026-11-04, Africa/Johannesburg.
**Branch:** [phase/04-product-likes](https://github.com/JerivasioYawa/EbenStudios/tree/phase/04-product-likes).
**Base:** completed Phase 3, commit 0b358ca9368a04d078efd65160ab37c196c70ba2.

Guests can like products locally without logging in. Account likes are saved in
SQLite and available to the same account from another browser. Login merges
guest likes safely, and hearts remain separate from product navigation.

## Relevant files

| File | Responsibility |
| --- | --- |
| [Prisma schema](../../../backend/prisma/schema.prisma) | ProductLike, user/product relations, unique pair, and cascade deletion |
| [Migration](../../../backend/prisma/migrations/20261104162858_product_likes/migration.sql) | Adds the table and indexes without altering existing business tables |
| [Like routes](../../../backend/src/routes/like.routes.js) | Authenticated account list, repeatable PUT, and repeatable DELETE |
| [Express app](../../../backend/src/app.js) | Mounts /api/likes |
| [Guest storage](../../../frontend/src/service/guestLikes.js) | Validated, deduplicated local product IDs and cross-tab storage events |
| [Like service](../../../frontend/src/service/likeService.js) | API calls and merge acknowledgement/retry behavior |
| [Likes provider](../../../frontend/src/context/LikesContext.jsx), [context](../../../frontend/src/context/likes-context.js), [hook](../../../frontend/src/hooks/useLikes.js) | Guest/account state, session ownership, merge jobs, and stale-response protection |
| [Heart button](../../../frontend/src/components/products/LikeButton.jsx) | Native keyboard-accessible toggle, pending state, errors, and pressed state |
| [Product card](../../../frontend/src/components/products/ProductCard.jsx) | Heart is a sibling of the product link, not nested inside it |
| [Product details](../../../frontend/src/pages/ProductPage.jsx) | Details heart alongside the product title |
| [Liked products page](../../../frontend/src/pages/LikedProducts.jsx) | Public /liked page, current catalogue details, empty/loading/error states, and retry |
| [Desktop navigation](../../../frontend/src/components/layout/Navbar.jsx), [mobile navigation](../../../frontend/src/components/layout/MobileMenu.jsx) | Liked-products link and desktop count |
| [Main providers](../../../frontend/src/main.jsx), [routes](../../../frontend/src/routes/AppRoutes.jsx) | Mounts the shared likes provider and /liked route |
| [API tests](../../../backend/test/api.test.js) | Authentication, duplicates/concurrency, ownership, ID validation, cascades, cart/stock isolation |
| [Service tests](../../../frontend/src/service/likeService.test.js) | Local persistence, corrupt/invalid storage, acknowledged merges, partial retry, stale/deleted IDs |
| [Provider tests](../../../frontend/src/context/LikesContext.test.jsx) | Strict Mode merge behavior, account switching, logout, stale requests, and retry |
| [Card tests](../../../frontend/src/components/products/ProductCard.test.jsx) | Mouse, Enter/Space, link separation, local storage failures, and loading state |
| [Browser journeys](../../../frontend/e2e/likes.spec.js) | Refresh persistence, complete login merge, separate browser context, and unchanged cart/stock |

## Prerequisites

Start at the repository root. Use the existing locked dependencies and local
environment from [Phase 01](../phase-01-local-setup/README.md). Browser installation
and test-server configuration remain as described in
[Phase 02](../phase-02-test-setup/README.md).

No new npm dependencies or service credentials are needed for Phase 4. Existing
authentication, cart behavior, and test database isolation remain in place.
Guest likes do not require login; the account API always does.

## Migration

The implementation ran these commands from backend, in order:

    npx.cmd prisma format
    npx.cmd prisma validate
    npx.cmd prisma migrate dev --name product_likes
    npx.cmd prisma generate

Migration 20261104162858_product_likes creates ProductLike and indexes only.
The (userId, productId) pair is unique. User and product foreign keys cascade
like deletion when the referenced record is deleted.

The useful local database was backed up consistently using VACUUM INTO before
migration. No reset was proposed or accepted. Existing business and cart records
were unchanged after migration and all tests; see [verification.md](verification.md).

For a fresh checkout or repeat migration deployment, use the recorded migration:

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

Expected result: five migrations applied or already applied, generated Prisma
Client, and an up-to-date database schema. Run commands one at a time and stop
on a nonzero exit code. Resolve migration conflicts instead of resetting useful data.

## Account API contract

All three routes require a verified bearer session. Ownership comes from the
authenticated user, never a client-supplied user ID.

| Method | Route | Success response | Behavior |
| --- | --- | --- | --- |
| GET | /api/likes | 200, array of current liked product objects | Lists only this account's products |
| PUT | /api/likes/:productId | 200, current product object | Likes once; repeated requests remain successful |
| DELETE | /api/likes/:productId | 204, no body | Removes only this account's like; already absent is also successful |

Product IDs must be positive integers within the Prisma Int range. Invalid IDs
receive 400. PUT for a missing product receives 404. Guest, expired, or invalid
sessions receive 401 before a write.

Database uniqueness prevents duplicate pairs. The upsert also handles a concurrent
unique-constraint race by confirming the existing owned pair. A product can be
liked while out of stock: likes do not reserve or decrement stock.

The likes routes write only ProductLike. They do not create cart items, alter
cart quantities, place orders, or update product price/stock.

## Guest storage and login merging

Guest storage uses the local key eben_guest_likes_v1 with a JSON array of positive
product IDs. Invalid values and duplicates are discarded on read; corrupt or
inaccessible saved data is treated as empty. A failed local write shows an error
and does not pretend the like succeeded.

After login, registration, or session restoration:

1. Capture the current session token and read unique pending guest IDs.
2. PUT each guest ID for the authenticated account.
3. Remove each local ID only after a successful server acknowledgement. A 404
   drops the stale ID for a deleted product.
4. Read the account's current liked products, preserving likes that already existed.

Acknowledged IDs are not imported again on refresh or later login. If a request
fails, remaining guest IDs stay local so Try Again or a later login can resume.
Repeating a PUT after a lost network response is safe because the server pair is unique.

Strict Mode effect replay reuses the same synchronization job. Account changes
serialize merge work while preventing old fetch or mutation results from replacing
the active account's state. Logout clears account state from the UI and does not
copy account likes into guest storage. Existing central 401/session handling is reused.

## Heart controls and liked products

Every product card uses an article with separate sibling link and heart button.
Clicking or pressing the heart therefore cannot activate product navigation.
The heart is a native type=button with a stable accessible product label,
aria-pressed state, a visible keyboard focus outline, and pending/loading disabling.
It supports normal mouse, Enter, and Space activation.

Product details expose the same shared heart state. The /liked page is available
to guests and authenticated users and is linked from desktop and mobile navigation.
It shows current catalogue information for liked IDs, along with loading, error,
retry, and empty states.

## Rerun the complete checkpoint

The API suite and browser backend each create and migrate their own disposable
SQLite database. No personal admin account or working database is used by the tests.

~~~powershell
npm.cmd --prefix backend test
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run test:e2e
~~~

The explicit manual test.db migration sequence from Phase 3 was also rerun:

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

The runner still creates its own isolated database when npm test executes.
The manual test.db checks migration deployment independently.

| Check | Verified result |
| --- | --- |
| Backend API tests | 33 passed |
| Frontend tests | Nine files, 43 tests passed |
| Frontend lint | Passed |
| Frontend production build | Passed |
| Chromium journeys | 11 passed, including all eight previous journeys |

## Completed checkpoint

- [x] Guest likes survive refresh.
- [x] Mouse, Enter, and Space like/unlike controls work.
- [x] Heart actions do not navigate to product details.
- [x] Repeated and concurrent likes cannot create duplicate pairs.
- [x] Login merges guest likes once and retains existing account likes.
- [x] Failed merges can retry without dropping unacknowledged preferences.
- [x] Account likes persist in a separate browser context.
- [x] Logout does not turn account likes into guest likes.
- [x] Likes never change cart contents, orders, or stock.
- [x] Migration preserves existing development data.
- [x] All required checks passed.

The phase snapshot is maintained on its dedicated branch under the standing
commit/push workflow in [AGENTS.md](../../../AGENTS.md). Verification history,
source provenance, data-integrity evidence, and warnings are in
[verification.md](verification.md). Reports and browser traces remain in their
normal ignored directories; credentials and database contents are not archived here.
