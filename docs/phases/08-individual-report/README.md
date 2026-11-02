# Phase 08 Final individual reflection and assessment

## Files and purpose

- `docs/reports/`
- `docs/testing/RESULTS.md`
- `docs/AUDIT.md`

## Implementation steps

1. Complete source improvements and collect available verification before writing the individual report.
2. Use Ayabonga’s submitted PDF for responsibility attribution: primary data/schema/money/snapshots, contributed validation/checkout/setup, reviewed cancellation, shared UI.
3. Structure the formal report around project context, technical and soft-skills learning, responsibilities/successes/disappointments, and prioritized recommendations.
4. Use concrete before/after examples and measured test results. Distinguish source implementation from unverified browser behaviour and production readiness.
5. Export Word and PDF below 15 pages, including cover/references. Check every rendered page for clipping and readable tables.
6. Assess the final report separately against four equal 25-point criteria. Include evidence, weaknesses, specific improvements and total out of 100. It is an advisory assessment, not a lecturer’s awarded mark.
7. Before submission, Ayabonga should review first-person reflection for accuracy and attach any locally obtained browser evidence.

## Checkpoint commands

```powershell
Get-Content docs/testing/RESULTS.md
Get-Content docs/AUDIT.md
git status --short
```

## Pass condition

Report created after implementation/available tests; Word/PDF match and remain under 15 pages; pending acceptance gates stated honestly.

## If a checkpoint fails

Do not convert pending work into claimed personal achievements. Update evidence and assessment only after the missing checks are actually completed.

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
