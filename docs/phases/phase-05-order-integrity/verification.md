# Phase 05 verification history

## 2026-11-04: Implementation started

**Status:** In progress. **Base:** `192d7653ab037384c30f5a2dda46b4bb243bb13f`.
**Branch:** `phase/05-order-integrity`.

The working tree was clean. A consistent SQLite backup was created under ignored
`backend/prisma/backups/` before changing the schema. SQLite integrity_check returned
`ok`; original counts and a logical digest were captured for preservation checks.
The development migration is not authorized until disposable-copy verification passes.

## 2026-11-04: Checkpoint verified

**Status:** Completed. **Source:** working tree based on
`192d7653ab037384c30f5a2dda46b4bb243bb13f`, branch `phase/05-order-integrity`.
The implementation and records were uncommitted during verification. The published
phase commit contains the final source and this history together; the base alone
does not contain Phase 5. Earlier phase branches retain their original snapshots.

### Migration sequence actually run

1. Created a consistent SQLite backup using VACUUM INTO before editing the schema.
   Its integrity_check returned `ok`.
2. Ran `npx.cmd prisma format` and `npx.cmd prisma validate` successfully.
3. Attempted `npx.cmd prisma migrate dev --name order_integrity --create-only`,
   including a terminal-mode retry. Prisma refused noninteractive migration
   authoring and reported the unsafe required priceCents addition/drop of price
   for four products. No reset or unsafe migration was accepted.
4. Generated a draft with Prisma migrate diff from the backup to the new schema,
   then replaced the destructive draft with deliberate conversion SQL in
   `20261104170707_order_integrity/migration.sql`. Opened that file in VS Code.
5. Ran the four permanent migration assertions successfully. Then ran
   `node scripts/verify-order-integrity-migration.js` against the actual backup.
   The verifier deployed pending migrations to a disposable copy, compared all
   expected converted business rows, checked foreign keys/integrity/sequences,
   and removed the copy. It returned `preserved: true`, integrity `ok`.
6. Only after those checks, ran `npx.cmd prisma migrate dev` against development.
   It applied the reviewed order_integrity migration with no reset. Ran
   `npx.cmd prisma generate` and `npx.cmd prisma migrate status`: six migrations,
   schema up to date, Prisma Client 5.22.0 generated.
7. Compared the development database against the expected conversion of the
   original backup: every table matched; integrity `ok`, no foreign-key violations.

The migration rounds original rand amounts to cents, retains the charged header
total and records any header/line difference in adjustmentCents. Historical unit
prices come from saved order lines, even when today's product has a different
price. Available customer/product metadata is backfilled, with original IDs,
timestamps, relationships and AUTOINCREMENT high-water marks preserved.

### Actual verification results

| Command/check | Result |
| --- | --- |
| Prisma format / validate | Passed |
| Disposable legacy migration suite | 4 passed |
| Disposable copy of real database | All expected converted rows matched; integrity ok |
| Development migrate dev / generate / migrate status | Passed; six migrations, schema current, no reset |
| DATABASE_URL=file:./test.db; prisma migrate deploy | Applied order_integrity to the separate local test database |
| Backend npm.cmd test | 45 passed: 41 API and 4 migration tests |
| Frontend npm.cmd test | 51 passed across 12 files |
| Frontend npm.cmd run lint | Passed, no errors or warnings from ESLint |
| Frontend npm.cmd run build | Passed; 1,861 modules transformed |
| Frontend npm.cmd run test:e2e, final complete run | 12 Chromium journeys passed in 42.2 seconds |
| Private/generated file checks | Environment files, databases, backup, builds and reports ignored; no tracked private environment/database files |

The first complete browser run passed all 11 existing journeys but found an
ambiguous selector in the new test: the quantity appeared both in the cart badge
and cart row. The selector was scoped to main content. Its targeted rerun passed,
then the final full run passed all 12 journeys. No application failure remained.

### API and concurrency evidence

- A three-item order at 29 cents saved unitPriceCents=29, lineTotalCents=87,
  totalCents=87, adjustmentCents=0. Submitted prices/totals never set the order price.
- Cart APIs rejected negative, zero, fractional, string, missing and excessive
  quantities. Database CHECK constraints rejected an invalid persisted quantity.
- When a later cart item lacked stock, the first stock decrement, provisional
  order and all other changes rolled back. Both saved cart rows remained.
- Two simultaneous HTTP purchases competed for one stock unit: one 201 and one
  409, one order, zero stock; the losing account kept its cart. A separate test
  used two independent Prisma clients against the same database with the same result.
- Four concurrent requests sharing an account/key produced one 201 and three 200
  responses with the same order ID. A later retry replayed it again, with one stock
  decrement. Changing shipping with that key failed with 409. Replaying after cart
  refill did not consume the new cart; a new key could create a new intended order.
- Product price/name/description/image URL and customer name/email edits left the
  saved order response unchanged. Deleting the product retained line snapshots
  and total, with productId set to null.

### Migration fixtures and failure preservation

The synthetic pre-migration database contained users, products, three historical
orders (including an empty order), order lines, a cart, cart item and like.
The fixtures deliberately used saved unit price 0.29 against current price 1.99,
floating total 0.8699999999999999, half-cent values, and raised sequence marks.

The upgraded 0.29 line stayed 29 cents per unit and 87 cents for three. Product
12.345 became 1,235 cents; 0.005 became one cent. An empty historical 25-rand order
kept 2,500 cents via its adjustment. A 2.47 header with lines converting to 248
cents retained the 247-cent header plus a -1-cent adjustment.

Every expected row and relationship matched, sequence high-water marks did not
regress, and integrity/foreign-key checks passed. Historical product deletion kept
the order line while dependent cart/like rows followed their existing cascade rules.
Three other tests separately introduced a negative historical quantity, fractional
cart quantity or negative price. Each migration failed the named legacy-data guard;
the complete original business-record digest remained unchanged after rollback.

### Browser and frontend evidence

Frontend assertions verified exact BigInt totals/formatting, including values
beyond Number's safe integer limit for aggregate display. Checkout key tests
covered persistence through module reload, stable item ordering, account isolation,
shipping/quantity changes, stale completion, storage failure, lost-response retry,
cart editing and the Idempotency-Key request header.

The new browser journey used the real test API/database to create a 29-cent
product, add three units and display R0.87 in cart/checkout. Its first checkout
actually committed on the server, then the test replaced only the receipt with
a 503 response. Pressing Place Order again sent the same key and got the same
order with 200 and Idempotency-Replayed=true. There was one 87-cent order, zero
stock and an empty cart. Editing, then deleting, the product left the displayed
historical name/total and saved line values intact.

All earlier customer, admin, authenticated-cart, expired-session and likes browser
journeys passed too. API and browser databases/users/products/uploads were generated
separately and removed; personal admin credentials were not test prerequisites.

### Development data preservation

The consistent backup remains local and ignored:

`backend/prisma/backups/phase-05-before-order-integrity-1793811893415.db`

| Model | Before | After |
| --- | --- | --- |
| User | 1 | 1 |
| Product | 4 | 4 |
| Order | 0 | 0 |
| OrderItem | 0 | 0 |
| Cart | 0 | 0 |
| CartItem | 0 | 0 |
| ProductLike | 0 | 0 |

The original ordered Prisma-record digest was:

```text
3299b71b6cd32cc4bd9bc341548c6f878a1f3c4f16bcf657d5bd602cfd294e59
```

The schema intentionally changes field names and amount representations, so an
unchanged raw digest is not the post-migration criterion. The verifier compares
each table's full expected converted records using canonical hashes, without
printing personal records/password hashes on failure. This passed for both the
disposable real-data copy and actual development database. The real database had
no historical orders; populated synthetic fixtures establish historical backfill
behavior independently.

### Environment, limitations and publication

Verified with Windows/PowerShell, Node.js 26.12.0, npm 11.20.0, Prisma 5.22.0,
Vite 8.3.5, Vitest 5.1.0 and Playwright 1.64.1 with Chromium. Process-launching
checks used the approved sandbox permissions. Vite emitted the existing Node
module.register deprecation warning; Playwright emitted color-environment warnings.
Neither prevented a check passing.

Money/quantity limits and the historical adjustment policy are documented in the
[rerun guide](README.md). Legacy product metadata predating the available product
row cannot be recovered because the old schema never saved it. Failed migration
guards require data review and resolution, not a database reset. No failing
checkpoint, lint error or build error remains. Phase 6 has not been started.

The final snapshot is published on
[`phase/05-order-integrity`](https://github.com/JerivasioYawa/EbenStudios/tree/phase/05-order-integrity),
stacked on Phase 4. The repository owner matches the connected GitHub account, with
push permission. The phase source/tests/migration/records are committed together;
the standing workflow verifies the remote branch SHA after pushing. Credentials,
database contents, backups and generated output are excluded from the commit.

### Final publication review

Git's whitespace check found one extra blank line at the end of the new SQL file.
Only trailing whitespace was removed; all SQL statements remained identical.
The SHA-256 checksum was synchronized for this still-unpublished migration in
local development/test migration metadata, guarded by the exact previous checksum.
No business rows were edited. The exact final file passed the disposable real-data
copy verifier again, and `prisma migrate dev` reported already in sync without a
reset or pending change. This checksum correction applies only to the new local
Phase 5 migration; no published phase migration was changed.
