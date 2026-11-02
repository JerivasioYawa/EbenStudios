# Deployment instructions

Local running is the accepted delivery target. No deployment was performed in this work. Existing frontend reference: https://eben-studios.vercel.app/.

## 1 Prepare a release

Complete local tests and browser checkpoints. Merge the reviewed improvement branch only when its results are acceptable. Retain a known-good source commit and private database backup for rollback.

## 2 Host the API with persistent storage

Use a Node 24 host that supports a long-running Express process and persistent disk. Set the service root to backend, install with `npm ci`, generate with `npx prisma generate`, migrate with `npm run db:deploy` during a stopped-service maintenance window, and start with `npm start`.

Configure server-only variables in the host:

| Variable | Deployment value |
| --- | --- |
| DATABASE_URL | Absolute persistent SQLite file, e.g. file:/data/eben.db |
| UPLOAD_DIR | Persistent directory, e.g. /data/uploads |
| JWT_SECRET | Independently generated production secret |
| PORT | Host-assigned listening port |
| CORS_ORIGINS | https://eben-studios.vercel.app plus explicitly approved frontend origins |
| PUBLIC_API_ORIGIN | Actual HTTPS API origin, without /api or trailing slash |

Create a production administrator through the environment seed only after reviewing whether demonstration products are appropriate. Do not expose seed credentials in build logs. Restrict server access, use HTTPS and schedule private backups. SQLite plus local uploads requires one application instance on durable storage; ephemeral serverless filesystem storage is not suitable.

If adopting PostgreSQL later, create a separate migration plan and data transfer with validation. Existing SQLite SQL migrations cannot be blindly rerun against PostgreSQL by changing provider alone. This change is deferred, not implemented.

## 3 Configure the Vercel frontend

Use frontend as the project root. Install with `npm ci`, build with `npm run build`, output directory dist. Set VITE_API_URL to the actual hosted API URL including /api. The checked-in frontend/vercel.json rewrites client routes to index.html. Redeploy after changing build-time VITE variables.

Never use localhost as a production API address: it refers to the visitor's computer. Never put JWT_SECRET, database credentials or admin seed passwords in VITE variables.

## 4 Verify the deployment

1. Open API /api/health and /api/products. Health alone does not prove database availability.
2. Open the storefront and confirm products come from the hosted API in browser Network tools.
3. Directly open and refresh /shop, /login and /products/<real-id>. Expect application screens, not platform 404s.
4. Register a dedicated test customer, order available stock and check the same ID in customer/admin views.
5. Upload a real product image; restart the API and confirm image and order still exist.
6. Confirm unexpected origins lack CORS access, and customer accounts receive 403 for admin endpoints.
7. Exercise backup restoration in a separate environment; compare row counts, totals and foreign keys.

Do not mark this section complete merely because the frontend build succeeds.

## 5 Rollback

Revert application code to the recorded known-good commit. For database changes, stop writes and restore the matching private backup only after assessing data created since backup; do not overwrite newer orders casually. Prefer a forward repair migration where possible. Recheck catalogue, authentication, checkout and historical orders.

## Deferred production work

Payment callbacks and settlement verification; account recovery and throttling; full image decoding/re-encoding and malware checks; monitoring; load tests; automated backup retention/restore drills; owner-supplied product photographs. Uploaded image header checks are not a complete security guarantee. Manual Paid status remains an operational record.
