# Phase 01 verification history

## 2026-11-04: Local setup completed

**Status:** Completed within the scope in [README.md](README.md).
**Source:** Working tree provenance is recorded in the [phase index](../README.md#archive-provenance).

| Check actually performed | Recorded result |
| --- | --- |
| Local environment file creation | `backend/.env` and `frontend/.env.local` created and opened in VS Code |
| JWT secret generation | 48 random bytes, stored as 96 hex characters in `backend/.env`; secret not recorded here |
| Git exclusions | Both environment paths printed by `git check-ignore`; no tracked private environment files or SQLite database files |
| `npx.cmd prisma validate` | Schema valid; exit code 0 |
| `npx.cmd prisma generate` | Prisma Client 5.22.0 generated; exit code 0 |
| `npx.cmd prisma migrate deploy` | All three migrations applied; exit code 0 |
| `npx.cmd prisma migrate status` | `Database schema is up to date!`; exit code 0 |
| Seed credential rejection checks | Missing email, missing password, and blank credentials rejected; all three checks passed |
| `npm.cmd run prisma:seed` from `backend` | `Seed complete.`; exit code 0 |
| Seeded admin verification | Account had the ADMIN role; bcrypt comparison matched the local environment password without printing it |
| `npm.cmd run dev` from `frontend` | Vite started at `http://localhost:5174/` because port 5173 was occupied |
| Frontend HTTP request | HTTP 200 from `http://localhost:5174/` |

Applied migrations:

1. `20260822164011_init`
2. `20260822170456_add_shipping_address`
3. `20260822181338_add_product_image_url`

## Resolved issues and rerun notes

- PowerShell blocked `npm.ps1`. Using `npm.cmd` and `npx.cmd` allowed the commands
  to run without changing execution policy.
- The coding sandbox blocked required child processes with `spawn EPERM`.
  Approved execution outside that sandbox allowed Prisma generation and migrations
  to run. This is a tooling permission issue, not an application test failure.
- The first migration attempt reported a schema engine error while the configured
  SQLite file did not exist. Creating the empty file, then retrying, applied all migrations.
- Port 5173 was already occupied. Vite selected 5174; future runs should use the
  URL printed by their own server.

There were no outstanding failures for the phase's recorded checkpoint.
Standalone API startup is documented for reruns but was not separately verified
as part of this phase. Test API startup and browser journeys were verified in Phase 02.

No credentials, password hashes, database contents, or private environment file
contents are stored in this record.

## 2026-11-04: Separate phase branch

The completed Phase 1 source and records are archived on
[`phase/01-local-setup`](https://github.com/JerivasioYawa/EbenStudios/tree/phase/01-local-setup).
This snapshot contains local configuration safeguards and protected seeding.
Later phase branches build on this commit. The verification results above were
recorded before the branch was created; they were not rerun solely for publication.
