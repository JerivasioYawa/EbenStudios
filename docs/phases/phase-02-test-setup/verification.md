# Phase 02 verification history

## 2026-11-04: Initial implementation

The Express app/listener separation, API tests, Vitest configuration and component
tests, and Playwright customer/admin journeys were implemented.

The first checks passed all 14 API tests, eight component tests, and frontend lint.
The first browser run passed four journeys and failed one assertion because a
`Shop` heading selector matched both the page heading and a footer heading.
The selector was narrowed to the level-one heading, and the test also verifies
the catalogue response after deletion. A rerun passed all five browser journeys.

This initial verification did not include the production build; the build was
subsequently verified in the checkpoint audit below.

## 2026-11-04: Phase 2 checkpoint audit

**Status:** Completed; all required checkpoint checks passed.
**Source:** Working tree provenance is recorded in the [phase index](../README.md#archive-provenance).

| Check actually run | Actual result | Exit code |
| --- | --- | --- |
| Backend `npm.cmd test` | 14 API tests passed; one suite; no failures or skips | 0 |
| Frontend `npm.cmd run lint` | Passed with no lint errors | 0 |
| Frontend `npm.cmd test` | Two files and eight component tests passed; no Playwright specs collected | 0 |
| Frontend `npm.cmd run build` | Production build succeeded; 1,847 modules transformed | 0 |
| Frontend `npm.cmd run test:e2e` | Five Chromium journeys passed | 0 |
| Git whitespace check | `git diff --check` passed | 0 |

These commands were executed from their respective backend/frontend directories.
The root-level `--prefix` commands in the rerun guide invoke the same npm scripts.

Verified browser journeys:

1. Admin login, product creation with an image, editing, deletion, and opening the shop.
2. Admin fulfilment and customer visibility of the persisted order status.
3. Customer registration, logout/login, shop browsing, cart persistence, checkout,
   order history, stock decrement, and cart clearing.
4. Guest and customer restrictions on checkout/admin routes.
5. A useful error for invalid customer login credentials.

## Development data integrity

The checkpoint audit calculated SHA-256 fingerprints of the configured local
development SQLite database before and after all API/browser tests and frontend
checks. The main database checksum was unchanged:

```text
3c982d581049f4b45ec94651d26d875d4a9871a6db0ba2780d1a373a5b25ae3a
```

The journal and WAL files were absent both before and after the checks. This
confirmed that the development database file was not modified during the audit.
The implementation also explicitly routes both test backends to freshly created
temporary databases before importing the application.

Local environment files, the development database, build output, Playwright
reports, and test results were confirmed ignored by Git. Their contents are not
included in this record.

## Verified environment

| Tool | Version |
| --- | --- |
| Node.js | 26.12.0 |
| npm | 11.20.0 |
| Prisma | 5.22.0 |
| Vite | 8.3.5 |
| Vitest | 5.1.0 |
| Playwright | 1.64.1 |

## Resolved issues and remaining notes

- Sandbox `spawn EPERM` failures prevented Node workers, Prisma engines, Vite,
  and Chromium from starting. Approved execution outside the coding sandbox
  allowed the checks to complete.
- The ambiguous browser selector was fixed before the successful browser reruns.
- Vite emitted Node's `module.register()` deprecation warning. The build and
  browser tests still completed successfully. Playwright also emitted color
  environment warnings; these did not affect results.
- No lint failures, build failures, or failing checkpoint assertions remained.

The results above were retained from actual executions earlier in this session.
Creating the phase documentation did not execute these checks again.

## 2026-11-04: Separate phase branch

The original Phase 2 implementation is archived on
[`phase/02-test-setup`](https://github.com/JerivasioYawa/EbenStudios/tree/phase/02-test-setup),
based on the Phase 1 commit. Its staged source uses the pre-Phase-3 snapshots
captured during this session: 14 API tests, eight frontend tests, and five browser
journeys. The authenticated-cart changes belong to the next phase branch.
The verification history above is retained from the original executions.
