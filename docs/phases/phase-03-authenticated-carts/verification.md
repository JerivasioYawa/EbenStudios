# Phase 03 verification history

## 2026-11-04: Implementation started

**Status:** In progress; checkpoint not yet verified.

Before editing the schema, a local SQLite backup was created under the ignored
`backend/prisma/backups/` directory. Existing record counts and a data digest were
captured for comparison after migration and testing. No reset is authorized.

## 2026-11-04: Migration and initial checks

The requested Prisma commands succeeded with exit code 0:

1. `npx.cmd prisma format`
2. `npx.cmd prisma validate`
3. `npx.cmd prisma migrate dev --name authenticated_carts`
4. `npx.cmd prisma generate`

Migration `20261104150434_authenticated_carts` created the Cart and CartItem tables,
foreign keys, unique ownership/item indexes, and a product index. It did not drop,
reset, or rebuild the existing business tables. Prisma Client 5.22.0 was generated.

The API suite passed all 25 tests. Frontend tests passed all 28 tests, and lint and
build also passed. The requested explicit `DATABASE_URL=file:./test.db` migration
deployment applied all four migrations successfully, followed by another successful
25-test API run. The shell environment was restored afterward. The runner itself
continued to use its own temporary database.

The first eight-journey browser run passed seven tests, including all three new
cart journeys. The existing non-admin login test failed because resetting the cart
by remounting a keyed provider also remounted the login page and erased its error.
The provider was changed to reset account/session state without remounting children.
Existing stale-request protections were retained and verified by component tests.

## 2026-11-04: Final Phase 3 checkpoint

**Status:** Completed; every requested checkpoint passed.
**Source:** Branch `improvement/auth-likes-admin-invoices`, based on
`216d7ce4874b1a1cf4735566408fbdd589f59d6a` with uncommitted implementation and
dependency changes. This base commit alone does not contain this implementation.
**Environment:** Windows/PowerShell, Node.js 26.12.0, npm 11.20.0, Prisma 5.22.0,
Vite 8.3.5, Vitest 5.1.0, and Playwright 1.64.1 using Chromium.

| Actual command/check | Working directory | Final outcome | Exit code |
| --- | --- | --- | --- |
| Test database migration plus `npm.cmd test` | backend | Four migrations applied to test.db; 25 API tests passed in a separate temporary database | 0 |
| `npm.cmd test` | frontend | Six files, 28 frontend tests passed | 0 |
| `npm.cmd run lint` | frontend | No lint errors | 0 |
| `npm.cmd run build` | frontend | Successful production build; 1,852 modules transformed | 0 |
| `npm.cmd run test:e2e` after the provider fix | frontend | Eight Chromium journeys passed | 0 |
| `git diff --check` | Repository root | No whitespace errors | 0 |
| Development data comparison | backend | Original record counts and logical SHA-256 digest unchanged | 0 |

### New browser scenarios verified against the real API

- Guests visiting cart/checkout were redirected to login. A guest cart API call
  returned 401. Clicking the guest product action sent no cart mutation, and login
  returned to the complete product URL including query and hash, without auto-adding.
- A customer's available item was saved with quantity one after the authenticated
  action, and was readable through the authenticated cart API.
- A logged out, B registered and saw an empty cart, B added a different product,
  and each account later restored only its own saved cart. The active badge cleared
  on logout.
- A correctly signed but expired test JWT was placed into the mounted customer's
  session. The real cart API returned 401 on the attempted add, the token was removed,
  login displayed the clear expiry message, and the saved cart remained empty.
  Reauthentication returned to the original product.

All five pre-existing customer/admin browser journeys also passed after their
fixtures and quantity-update waits were adjusted for asynchronous persisted carts.

### API and frontend evidence

The API suite covers missing/expired/deleted-user sessions, read-only empty cart
requests, account ownership despite supplied foreign IDs, quantity validation,
aggregate stock checks, saved product quantities, unchanged stock on cart writes,
current-price checkout, forged checkout payloads, cart clearing, and transactional
rollback when stock becomes unavailable.

Frontend tests cover guest and loading-state mutation rejection, protected
destinations, preserved/safe login URLs, cart rendering and persistence, logout,
late account fetches and mutations, central authenticated 401 handling, failed
public login, late old-account 401s, and queued requests with stale session tokens.

### Development data integrity

The pre-migration backup is stored locally at:

`backend/prisma/backups/phase-03-before-authenticated-carts-1793804564286.db`

It is ignored by Git and is not included in these records. The existing business
records had the following counts both before migration and after all checks:

| Model | Before | After |
| --- | --- | --- |
| User | 1 | 1 |
| Product | 4 | 4 |
| Order | 0 | 0 |
| OrderItem | 0 | 0 |

The SHA-256 digest of the complete, ordered original records was identical:

```text
8b8eeec68a45612f76d393e5c5030ab4a55166fa8b8fd360aba42662d85e932a
```

The development database also contained zero carts and zero cart items after
testing. Test mutations used isolated databases. A logical data digest was used
because the additive schema migration intentionally changes the database file.

### Remaining notes

- No migration reset was proposed or accepted.
- The page-remount regression from the first browser run was fixed; all final checks passed.
- Vite still emits Node's `module.register()` deprecation warning, and Playwright
  emits color-environment warnings. They did not prevent the build or tests passing.
- Existing uncommitted work from earlier phases was preserved. No commit or deployment was made.
- The local backup and manual test.db file remain ignored. Credentials and database
  contents are not archived here.

## 2026-11-04: Separate phase branch

The completed Phase 3 implementation is archived on
[`phase/03-authenticated-carts`](https://github.com/JerivasioYawa/EbenStudios/tree/phase/03-authenticated-carts),
based on the Phase 2 commit. It contains the authenticated-cart migration and the
final source verified above, including 25 API tests, 28 frontend tests, and eight
Chromium journeys. The prior phase branches preserve their earlier snapshots.
