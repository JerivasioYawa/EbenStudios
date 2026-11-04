# Phase 01: Local environment and database setup

**Status:** Completed. **Last verified:** 2026-11-04.

This phase prepares local configuration, applies the existing SQLite migrations,
and seeds an admin and starter products using local credentials. The frontend
development server was also started and checked. Standalone API startup commands
below are rerun instructions, not a claim that a standalone API health check was
performed during this phase.

## Relevant files

| File | Purpose |
| --- | --- |
| [Root .gitignore](../../../.gitignore) | Excludes private environment files, databases, dependencies, uploads, builds, and reports |
| [Backend package.json](../../../backend/package.json) | Backend, Prisma, and seed commands |
| [Prisma schema](../../../backend/prisma/schema.prisma) | SQLite models and `DATABASE_URL` |
| [Migrations](../../../backend/prisma/migrations/) | Three committed schema migrations |
| [Seed script](../../../backend/prisma/seed.js) | Requires environment credentials, hashes the password, and logs no credentials |
| [Backend entry point](../../../backend/src/index.js) | Loads environment configuration and starts the API |
| [Frontend API client](../../../frontend/src/service/api.js) | Reads `VITE_API_URL`, with a localhost API fallback |

Local `backend/.env` and `frontend/.env.local` are ignored and are not archived.

## Prerequisites

Start in the repository root with Node.js and npm installed. Install the locked
dependencies on a new machine:

```powershell
npm.cmd --prefix backend ci
npm.cmd --prefix frontend ci
```

## 1. Configure local environment files

The backend needs these variables:

| Variable | Local value or source |
| --- | --- |
| `DATABASE_URL` | `file:./dev.db`, resolved relative to `backend/prisma/schema.prisma` |
| `PORT` | `4000` |
| `JWT_SECRET` | A generated secret stored only in the local environment file |
| `ADMIN_EMAIL` | Your chosen local seed admin email |
| `ADMIN_PASSWORD` | Your chosen or generated local seed admin password |

The following command creates missing values without printing credentials or
overwriting existing nonblank values. On a fresh setup it uses
`admin@ebenstudios.test` as a local email; change that value in your editor if needed.
It requires the backend dependencies installed above.

```powershell
@'
const fs = require('node:fs');
const crypto = require('node:crypto');
const dotenv = require('./backend/node_modules/dotenv');
const file = 'backend/.env';
let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const existing = dotenv.parse(text);
const values = {
    DATABASE_URL: 'file:./dev.db',
    PORT: '4000',
    JWT_SECRET: crypto.randomBytes(48).toString('hex'),
    ADMIN_EMAIL: 'admin@ebenstudios.test',
    ADMIN_PASSWORD: crypto.randomBytes(32).toString('hex'),
};
for (const [key, value] of Object.entries(values)) {
    if (existing[key]?.trim()) continue;
    const entry = key + '=' + value;
    const pattern = new RegExp('^[\\t ]*(?:export[\\t ]+)?' + key + '[\\t ]*=.*$', 'm');
    text = pattern.test(text)
        ? text.replace(pattern, () => entry)
        : text + (text && !text.endsWith('\n') ? '\n' : '') + entry + '\n';
}
fs.writeFileSync(file, text, 'utf8');
console.log('Local backend environment configured. Credentials were not printed.');
'@ | node
```

Create `frontend/.env.local` if it is missing, then set its API URL in your editor:

```powershell
if (!(Test-Path -LiteralPath frontend/.env.local)) {
    New-Item frontend/.env.local -ItemType File | Out-Null
}
code frontend/.env.local
```

```dotenv
VITE_API_URL=http://localhost:4000/api
```

This browser-facing variable contains the API address. Backend credentials stay
in `backend/.env`. Restart Vite after changing its environment file.

## 2. Verify Git exclusions

```powershell
git check-ignore backend/.env frontend/.env.local
git ls-files "*.env" "*.env.*" "*.db" "*.db-journal"
```

The first command must print both local environment paths. The second must not
list private environment files or working databases; safe `.env.example`
templates may be tracked.

## 3. Validate, generate, and migrate

These commands assume the default `DATABASE_URL=file:./dev.db` and preserve an
existing database. Adjust the path if your local configuration uses a different file.

```powershell
Push-Location backend
try {
    npx.cmd prisma validate
    npx.cmd prisma generate
    if (!(Test-Path -LiteralPath prisma/dev.db)) {
        New-Item prisma/dev.db -ItemType File | Out-Null
    }
    npx.cmd prisma migrate deploy
    npx.cmd prisma migrate status
} finally {
    Pop-Location
}
```

Expected results: a valid schema, a generated Prisma Client, all three migrations
applied or already applied, and `Database schema is up to date!`. Creating the
empty SQLite file first resolved the initial schema engine failure on this machine.

## 4. Seed local data

```powershell
npm.cmd --prefix backend run prisma:seed
```

Expected output: `Seed complete.` Missing or blank `ADMIN_EMAIL` or
`ADMIN_PASSWORD` must produce an error and a nonzero exit code instead.

The seed inserts the admin and four named starter products if they are missing.
Existing records are preserved: rerunning it does not reset stock, overwrite
products, or rotate an existing admin password. Changing `ADMIN_PASSWORD` in the
environment file alone does not update an already-created account.

## 5. Run the application

Use two terminals, both initially at the repository root:

```powershell
# Terminal 1: backend
npm.cmd --prefix backend run dev
```

```powershell
# Terminal 2: frontend
npm.cmd --prefix frontend run dev
```

The normal API address is `http://localhost:4000/api`. Open the frontend URL
printed by Vite; it chooses another port when `5173` is occupied. A standalone
API health check can be run from another terminal:

```powershell
Invoke-RestMethod -Uri http://localhost:4000/api/health
```

Expected API result: `status: ok`. Stop a development server with Ctrl+C in its terminal.

## Checkpoint and results

- [x] Local environment files exist and are ignored by Git.
- [x] No private environment files or working databases were tracked at verification.
- [x] Seed credentials come from the environment and are required.
- [x] Seed passwords are hashed and credentials are not printed.
- [x] Schema validation, client generation, and all three migrations succeeded.
- [x] Seeding succeeded and the stored admin password matched the local credentials.
- [x] The frontend responded successfully at the URL printed by Vite.

See [verification.md](verification.md) for the historical results and resolved
setup issues. Continue with [Phase 02](../phase-02-test-setup/README.md) for isolated tests.
