# Phase 04 verification history

## 2026-11-04: Implementation started

**Status:** In progress. **Source:** `0b358ca9368a04d078efd65160ab37c196c70ba2`.
**Branch:** `phase/04-product-likes`.

The starting working tree was clean. A consistent local SQLite backup was created
under the ignored `backend/prisma/backups/` directory before editing the schema.
Counts and a logical digest of all existing business and cart records were recorded
for comparison after migration and testing. No reset is authorized.

## 2026-11-04: Migration and implementation verification

**Status:** Completed; every Phase 4 implementation checkpoint passed.
**Verification source:** `phase/04-product-likes`, based on
`0b358ca9368a04d078efd65160ab37c196c70ba2`, with Phase 4 implementation changes
uncommitted while checks were run. The dedicated phase branch records the final
snapshot; the base commit alone does not contain these changes.

The requested commands ran from `backend` with exit code 0:

1. `npx.cmd prisma format`
2. `npx.cmd prisma validate`
3. `npx.cmd prisma migrate dev --name product_likes`
4. `npx.cmd prisma generate`

Migration `20261104162858_product_likes` added ProductLike and its unique
user/product pair, product index, and foreign keys. It did not drop or rebuild
the existing business tables. No database reset was proposed or accepted.

### Actual checks run

| Command/check | Working directory | Actual result | Exit code |
| --- | --- | --- | --- |
| `npm.cmd test` | backend | 33 API tests passed | 0 |
| Explicit `DATABASE_URL=file:./test.db`, migration deploy, then `npm.cmd test` | backend | Fifth migration applied to test.db; 33 API tests passed in their own temporary database; shell variable restored | 0 |
| `npm.cmd test` | frontend | Nine files and 43 frontend tests passed | 0 |
| `npm.cmd run lint` | frontend | No lint errors | 0 |
| `npm.cmd run build` | frontend | Production build succeeded; 1,859 modules transformed | 0 |
| `npm.cmd run test:e2e` | frontend | 11 Chromium journeys passed | 0 |
| Existing development data comparison | backend | All original counts and the logical SHA-256 digest were unchanged | 0 |

All newly added checks and the complete browser suite passed on their first run.
The existing Phase 3 API, frontend, and eight browser scenarios continued to pass.

### API evidence

- Every guest likes route and an expired-session PUT returned 401, saving no rows.
- Read-only empty account queries created no likes. Lists returned current product
  details for the verified user only.
- Three repeated PUTs produced one row; repeated DELETEs succeeded and left no row.
- Eight concurrent PUTs all returned 200 and left exactly one unique user/product pair.
- Supplied foreign user IDs could not read, delete, or create another account's likes.
- Invalid product IDs were rejected; missing products did not create rows.
- Like and unlike operations left complete product, cart, cart-item, and order
  snapshots unchanged, including an out-of-stock product.
- User and product deletion removed dependent likes through their foreign keys.

### Frontend evidence

Service tests checked validated local persistence, corrupted storage, storage
write errors, merging unique IDs only once, partial-failure retry, stale/deleted
product IDs, and an account switch during a merge.

Provider tests checked guest operation without account API calls, Strict Mode
effect replay using one merge job, loading-state rejection, old-account fetch
and mutation suppression, logout, and deliberate retry after a sync error.

Card tests confirmed the native heart is outside the link, exposes pressed and
loading states, and toggles with mouse, Enter, and Space without navigating.
Storage errors were announced without displaying an unsaved like.

### New real-browser journeys

1. A guest toggled the card heart with mouse, Enter, and Space; refreshed; toggled
   the details heart; opened the liked-products page; removed the like; and refreshed
   again. The hearts did not cause navigation, no account likes requests were sent
   by the page, and product stock stayed unchanged.
2. A guest liked two products before logging in to an account with an existing
   like and saved cart. Login sent exactly one PUT per guest ID, retained the
   existing like, and removed consumed local IDs. Refresh and later logout/login
   sent no extra merge PUTs. Removing a merged like did not recreate it later.
   The saved cart and all product stock values remained unchanged.
3. A customer liked a product, logged in from an independent browser context with
   separate local storage, and saw the saved like. Removing it there was visible
   in the first browser. Account likes never appeared as guest preferences after logout.

### Development data integrity

The consistent pre-migration backup remains local and ignored:

`backend/prisma/backups/phase-04-before-product-likes-1793809679297.db`

The complete ordered records were fingerprinted before the migration and after
all checks. Counts remained:

| Model | Before | After |
| --- | --- | --- |
| User | 1 | 1 |
| Product | 4 | 4 |
| Order | 0 | 0 |
| OrderItem | 0 | 0 |
| Cart | 0 | 0 |
| CartItem | 0 | 0 |

Their logical SHA-256 digest remained:

```text
5df73f9f5c2afcc5ea5e21a6772c430180e0f6c6ba2c5dd97b995af68e155580
```

The development database contained zero ProductLike rows afterward. Test likes
were saved only in disposable test databases. A logical record digest was used
because the additive schema migration intentionally changes the database file.

### Environment and remaining notes

The verified tools were Windows/PowerShell, Node.js 26.12.0, npm 11.20.0,
Prisma 5.22.0, Vite 8.3.5, Vitest 5.1.0, and Playwright 1.64.1 with Chromium.
Required process-launching commands ran with the approved sandbox permissions.

Vite emitted the existing Node `module.register()` deprecation warning, and
Playwright emitted color-environment warnings. These did not prevent checks passing.
No failing implementation checkpoint, lint error, or build error remained.
Guest data/storage failures keep unacknowledged IDs available for a later retry.
Secrets, actual credentials, and database contents are not included in these records.

### Phase branch

The final phase snapshot is on
[`phase/04-product-likes`](https://github.com/JerivasioYawa/EbenStudios/tree/phase/04-product-likes),
stacked on the completed Phase 3 branch. The standing workflow commits the verified
source and these records together and verifies the remote commit after pushing.
