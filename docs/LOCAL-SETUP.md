# Local setup on Windows PowerShell

Run commands one block at a time. Check `$LASTEXITCODE` after npm/Git commands: zero means success. Stop and resolve errors before continuing. Use `npm.cmd`/`npx.cmd` if PowerShell blocks the `.ps1` launchers.

## 1 Locate the project

Open the folder containing `backend` and `frontend` in VS Code.

```powershell
node --version
npm --version
git --version
Test-Path .\backend\package.json
Test-Path .\frontend\package.json
git status --short
```

Expected: Node 24.x; both paths True. Preserve unrelated uncommitted work before switching branches. Obtain the improvement branch using GITHUB-HANDOVER.md if it is not yet on GitHub.

## 2 Install locked dependencies

```powershell
npm --prefix backend ci --include=dev
if ($LASTEXITCODE -ne 0) { throw "Backend install failed" }
npm --prefix frontend ci --include=dev
if ($LASTEXITCODE -ne 0) { throw "Frontend install failed" }
```

Expected: both installations finish successfully. Do not delete the lockfiles to work around errors; verify Node version and inspect the error first.

## 3 Configure private environment files

```powershell
if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
if (-not (Test-Path frontend/.env)) { Copy-Item frontend/.env.example frontend/.env }
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Paste the generated value into `backend/.env` as JWT_SECRET. Set SEED_ADMIN_PASSWORD to a unique password of at least 16 characters and at most 72 UTF-8 bytes. Set SEED_ADMIN_EMAIL to your local admin email. Do not publish these values.

Keep `DATABASE_URL="file:./dev.db"`, `PORT=4000`, `CORS_ORIGINS=http://localhost:5173`, and frontend `VITE_API_URL=http://localhost:4000/api`. Open the frontend at localhost, not 127.0.0.1, unless you add that separate origin to CORS_ORIGINS. Keep Vite on port 5173 or update the allowed origin.

```powershell
git check-ignore backend/.env frontend/.env
git ls-files -- backend/.env frontend/.env
```

Expected: first command lists both ignored files; second prints nothing. VITE variables are public browser configuration, never secrets.

## 4 Prepare the database

Stop the API and Prisma Studio before migration. If you have existing data, copy the entire `backend/prisma` folder to a private backup folder outside the repository first. SQLite journal/WAL files must not be discarded while the database is in use.

```powershell
Set-Location backend
npx prisma validate
npx prisma generate
npm run db:deploy
npx prisma migrate status
npm run prisma:seed
Set-Location ..
```

Expected: valid schema, generated client, five applied migrations and a successful seed. The setup script creates an absent SQLite file without overwriting existing data. For legacy floating-price databases it makes a timestamped backup, runs preflight, applies migrations and verifies preservation. It does not reset databases. Already-converted databases skip the legacy preflight.

Seeding creates the configured administrator and four demonstration products; existing product stock/prices are preserved. Rerunning seed resets the configured administrator's password. It refuses to promote a customer with that email. No passwords are printed. `file:./dev.db` resolves under `backend/prisma`.

## 5 Verify before running

```powershell
npm --prefix backend run test:all
npm --prefix frontend run lint
npm --prefix frontend run build
```

Expected: 21 backend tests pass; syntax check passes; lint has no errors; build produces frontend/dist. Tests use temporary databases and uploads, not your dev.db. The Node SQLite experimental warning, where emitted by Node 24, does not itself fail tests.

## 6 Start both applications

Terminal A, from repository root:

```powershell
npm --prefix backend run dev
```

Terminal B, from repository root:

```powershell
npm --prefix frontend run dev -- --port 5173 --strictPort
```

Terminal C:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
Invoke-RestMethod http://localhost:4000/api/products | Select-Object id,name,priceCents,stock
```

Expected: status ok and four seed products on a fresh database. Open http://localhost:5173. The API root `/` returning Not found is expected; the website is on 5173. Keep both terminals open.

## 7 Browser acceptance

Use a disposable local demo database. The browser test creates a customer and one order, consuming one hoodie. It preserves its created records as evidence; do not run it against production.

```powershell
Set-Location frontend
npx playwright install chromium
npm run test:browser
Set-Location ..
```

Expected after a successful run: customerJourney PASS, mobileNavigation PASS and no page errors. Screenshots are written to ignored frontend/test-results. Run docs/testing/MANUAL-CHECKLIST.md too; the automated smoke does not cover every admin or accessibility behaviour.

## Troubleshooting checkpoints

| Symptom | Check and resolution |
| --- | --- |
| Schema engine error on an absent SQLite file | Use npm run db:deploy rather than manually assuming a file exists. |
| Preflight rejects old data | Keep the backup; inspect the listed invalid totals, quantities or references. Correct legitimate records deliberately, rerun preflight, then deploy. Never reset to conceal a failure. |
| Shop cannot load | Check API health AND products, VITE_API_URL including /api, exact CORS origin and both running servers. |
| Checkout reports missing reference | Ensure updated orderService.js is loaded; restart Vite; inspect Idempotency-Key header. |
| Admin login fails | Seed the intended database and use the configured email/password; user role must be ADMIN. |
| Stale session after secret changes | Log out and log in again. |
| Browser automation cannot launch | Install Chromium; use manual checklist if the environment prevents launch and record it as pending. |
