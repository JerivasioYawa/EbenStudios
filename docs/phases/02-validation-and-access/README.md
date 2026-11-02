# Phase 02 Validation and access control

## Files and purpose

- `backend/src/lib/validation.js`
- `backend/src/routes/auth.routes.js`
- `backend/src/middleware/auth.js`
- `backend/tests/validation.test.js`

## Implementation steps

1. Require object bodies, whole-number IDs, bounded quantities and valid monetary input at API boundaries.
2. Normalize email and require new passwords of at least 12 characters, capped at 72 UTF-8 bytes for bcrypt.
3. Ignore caller-supplied roles on registration. Retrieve current account role from the database on protected requests.
4. Return 400 for invalid input, 401 for unauthenticated requests and 403 for forbidden operations. Do not return password hashes.
5. Match form labels and password guidance to backend rules; browser validation supplements the server.

## Checkpoint commands

```powershell
npm --prefix backend run test:validation
npm --prefix backend run test:integration
```

## Pass condition

Validation tests and HTTP authentication/authorization cases pass; malformed registration creates no account.

## If a checkpoint fails

Inspect failing response and database state. Do not weaken validation or remove role checks to pass a UI test.

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
