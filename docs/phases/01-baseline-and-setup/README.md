# Phase 01 Baseline and reproducible setup

## Files and purpose

- `.gitignore`
- `backend/.env.example`
- `frontend/.env.example`
- `backend/prisma/seed.js`

## Implementation steps

1. Read docs/AUDIT.md and compare the submitted PDF with the ZIP and GitHub baseline. Keep GitHub as the history base.
2. Preserve unrelated working changes. Create the improvement branch once; if already present, switch to it.
3. Keep backend/frontend locations. Exclude secrets, SQLite files, uploads, dependencies and build artifacts.
4. Configure Node 24, install lockfiles and create local environments using LOCAL-SETUP.md steps 1–3.
5. Use the environment-based seed; do not copy the ZIP's local .env, database, dependencies or editor metadata.

## Checkpoint commands

```powershell
git status --short
git branch --show-current
npm --prefix backend ci --include=dev
npm --prefix frontend ci --include=dev
git check-ignore backend/.env frontend/.env
git ls-files -- backend/.env frontend/.env
```

## Pass condition

Installs exit zero; branch is improvement/term4-completion; secrets ignored and not tracked.

## If a checkpoint fails

Stop if files are missing or credentials are tracked. Fix ignore rules and rotate exposed secrets; do not delete useful source files.

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
