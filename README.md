# Eben Studios

React storefront and Express/Prisma/SQLite API for the Eben Studios streetwear project. This improvement branch integrates the supplied ZIP's backend work and completes missing customer/admin connections. Local academic prototype; payment processing and production hosting are not claimed.

## Start here

1. Use Node.js **24.x**, npm and Git.
2. Follow [local setup](docs/LOCAL-SETUP.md), including private environment values.
3. Work through [eight phases](docs/phases/README.md) and their checkpoints.
4. Read [verification results](docs/testing/RESULTS.md) and run the browser checks on your computer.
5. Use [deployment instructions](docs/DEPLOYMENT.md) when ready to host the API and frontend.
6. Publish with [GitHub handover](docs/GITHUB-HANDOVER.md).

## Repository structure

| Folder | Responsibility |
| --- | --- |
| `backend/src/routes` | Authentication, catalogue and order HTTP endpoints |
| `backend/src/services` | Transactional checkout and status changes |
| `backend/src/lib` | Prisma, validation, money and response presentation |
| `backend/src/middleware` | Current database roles and upload checks |
| `backend/prisma/migrations` | Five ordered migrations; preserve their history |
| `backend/scripts` | Database setup, migration preflight/preservation and syntax checks |
| `backend/tests` | Unit, HTTP integration and legacy migration tests |
| `frontend/src` | Customer/admin screens, services, hooks and shared components |
| `frontend/tests` | Repeatable browser smoke journey |
| `docs/phases/01-*` through `07-*` | Phase-specific implementation, commands and checkpoints |
| `docs/testing` | Actual command output and pending manual verification |
| `docs/DATA-DESIGN.md` | Implemented ERD and constraints |

The live frontend reference is https://eben-studios.vercel.app/. This work does not deploy changes there or certify its current API connectivity.

## Implemented boundaries

- Server-authoritative integer-cent pricing, stock checks and transactional order creation.
- Same checkout key and request return the original order; changed payload/key ownership conflicts.
- Pending → Paid/Cancelled → appropriate final lifecycle; cancellation returns stock once.
- Product archive/restore preserves purchase-time names and prices.
- Database-backed roles, account validation and constrained image uploads.
- Current catalogue reconciliation, exact-cent estimates, real featured products and product search.
- No unpersisted newsletter signup or unsupported category filters.

`Paid` is a manually recorded status, not evidence of payment settlement. Browser tests remain pending because this execution environment could not launch a browser. See the results file for the exact verification boundary.
