# Phase completion records

When completing a user-defined project phase, update its record under
`docs/phases/` and the index in `docs/phases/README.md`.

- Use `docs/phases/_template/` when adding a new phase.
- Record the scope, affected files, prerequisites, working directories, rerun
  commands, expected outcomes, actual verification results, date, and open issues.
- Mark a phase completed only after its required checkpoint passes. Distinguish
  checks actually run from suggested commands and unverified assumptions.
- Append dated verification entries when rerunning a completed phase; retain the
  previous results. Record the source commit and whether the working tree was dirty.
- Keep credentials, private environment files, databases, and dependency folders
  out of the records. Document variable names and credential-generation steps instead.

## Phase branches and commits

The user has requested a separate branch, commit, and push for every completed phase.

- Use `phase/NN-short-description` for each phase and start from the previous
  completed phase's branch. Keep earlier phase branches as their original snapshots.
- After the phase's required checks pass, commit its implementation, tests,
  migration files, and phase records together, then push the phase branch to `origin`
  with upstream tracking. This workflow is authorized by the user's standing request.
- Stage only files belonging to the phase. Confirm private environment files,
  databases, uploads, dependencies, build output, and reports are excluded.
- Record the branch in the phase index and verification history. Preserve prior
  checks and distinguish the original verification source from the published snapshot.
- Verify the remote branch points to the local commit after pushing. Report any
  publication failure accurately; do not claim a branch was pushed until confirmed.
- Do not force-push, rewrite published phase history, or push directly to the
  default branch unless the user explicitly requests it.
