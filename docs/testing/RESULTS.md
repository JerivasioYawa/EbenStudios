# Verification results

Final local code checks completed 2 November 2026 using Node 24.22.1. Results describe this improvement branch, not the existing deployed frontend. Reproduce commands from repository root.

| Check | Actual result | Evidence |
| --- | --- | --- |
| Clean backend and frontend installs | Both npm ci installations succeeded with locked dependencies | Local execution |
| Backend unit, HTTP and migration tests | 21 passed, 0 failed, 0 skipped | backend-results.txt |
| Backend syntax | 20 JavaScript files passed | backend-results.txt |
| Prisma schema/client | Schema valid; Prisma Client 5.22 generated | Local execution and HTTP setup |
| Fresh schema | All five migrations applied in isolated HTTP test database | integration.test.js |
| Legacy preservation | Cents, names, IDs, stock and references retained; seven invalid SQL writes rejected | migration.test.js |
| Frontend lint | Passed, no lint errors | frontend-lint.txt |
| Frontend build | Passed, Vite 8.3.5 | frontend-build.txt |
| Backend dependency audit | 0 advisories | backend-audit.json |
| Frontend runtime audit | 0 advisories with --omit=dev | frontend-runtime-audit.json |
| Frontend full audit | 6 moderate, 0 high/critical; minimatch/ESLint development chain | frontend-audit.json |
| Browser smoke/visual/accessibility | Pending; browser could not launch in authoring environment | MANUAL-CHECKLIST.md and frontend/tests/browser-smoke.cjs |
| Hosted frontend/API integration | Not tested or deployed in this work | DEPLOYMENT.md |
| Remote GitHub Actions | Not yet run by this session | Workflow prepared, inspect after publishing |

The original seven helper tests are retained. Added cases cover registration validation, roles, order replay/conflicts, customer history isolation, invalid quantities, transactional rollback, repeated cancellation, lifecycle transitions, snapshots/archive/restore, concurrent stock, uploads and CORS. A migration fixture tests representative old records and constraint failures; it is not a migration of a real production database.

Browser failures were environmental: Chromium launch failed with an operating-system socket permission error; the alternate browser tool failed to initialize because its session location was read-only. No browser pass, screenshot evidence, accessibility score or production readiness is claimed. The provided smoke test creates synthetic account/order data in the local demo database; run it with both servers running and then complete the manual checks.

Compatible dependency updates removed the original high/critical findings. Nodemon was replaced with Node's built-in --watch to remove its affected minimatch chain. Remaining frontend findings are development-tool dependencies; npm reported no compatible fix. Do not use --force to accept an unrelated breaking downgrade. Audit counts are a snapshot, not a permanent safety guarantee.
