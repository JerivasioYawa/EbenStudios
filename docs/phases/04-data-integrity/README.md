# Phase 04 Data integrity and safe migrations

## Files and purpose

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/`
- `backend/src/lib/money.js`
- `backend/scripts/prepare-database.js`
- `backend/scripts/phase4-preflight.js`
- `backend/scripts/phase4-verify.js`
- `docs/DATA-DESIGN.md`

## Implementation steps

1. Stop API/Studio and back up any useful database outside the repository. Do not migrate an active SQLite database.
2. Retain the original three migration files unchanged; apply the two ZIP migrations in order.
3. Convert legacy amounts to integer cents. Copy item prices and available product names into snapshots. Preserve identifiers and foreign keys.
4. Use db:deploy: it creates a missing file, detects legacy columns, backs up and checks old records, applies migrations and verifies preservation.
5. Update the ERD to the actual four-entity model. Document the password field as a hash, not a renamed column.
6. Inspect future migrations for lost custom CHECK constraints. Run the migration fixture before approving changes.

## Checkpoint commands

```powershell
Set-Location backend
npx prisma validate
npx prisma generate
npm run db:deploy
npx prisma migrate status
npm run test:money
node --test tests/migration.test.js
Set-Location ..
```

## Pass condition

Five migrations applied; fresh and legacy fixture paths preserve cents, stock, IDs and references; seven invalid SQL operations rejected.

## If a checkpoint fails

On preflight failure, keep the backup and correct the identified data deliberately. Do not use migrate reset, db push or edit already-applied migration SQL.

## Review and commit checkpoint

Review the listed paths and dependent changes. If following the completed branch, the implementation is already committed; do not create empty phase commits.

```powershell
git diff --check
git status --short
# When you have made a verified correction, stage only its actual files:
# git add -- <reviewed-file-paths>
git diff --cached --stat
```

Record the actual command, date, result and evidence path in docs/testing/RESULTS.md. Continue only when required prior checks pass; carry environment-blocked checks as explicit pending acceptance items.
