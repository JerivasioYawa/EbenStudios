# Phase 07 Regression verification and handover

## Files and purpose

- `backend/tests/`
- `frontend/tests/browser-smoke.cjs`
- `.github/workflows/ci.yml`
- `docs/testing/`
- `docs/DEPLOYMENT.md`

## Implementation steps

1. Run tests on a disposable database. The HTTP suite manages its own temporary database/uploads.
2. Validate all five migrations and the legacy fixture. Record actual command outputs, not expected text pasted as results.
3. Run frontend lint/build and the browser smoke on local servers. Follow the manual admin/accessibility checklist as well.
4. Run audits for all dependencies and runtime-only dependencies. Review compatible fixes; do not force major downgrades.
5. Review the source diff, ignored files and test logs. Ensure no passwords, JWTs, real customer addresses or database files are staged.
6. Use GITHUB-HANDOVER.md to push the branch, open a PR, and inspect actual CI. Remote CI is not claimed before the branch is published.
7. Keep deployment as instructions until a persistent backend and production verification are available.

## Checkpoint commands

```powershell
npm --prefix backend run test:all
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix backend audit --omit=dev
npm --prefix frontend audit --omit=dev
git diff --check
git status --short
```

## Pass condition

Recorded tests/lint/build pass. Runtime audit findings and development-only findings recorded separately. Browser and remote CI remain explicit pending gates.

## If a checkpoint fails

Fix regressions before merging. If tooling is blocked, record the actual limitation and rerun on an enabled machine.

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
