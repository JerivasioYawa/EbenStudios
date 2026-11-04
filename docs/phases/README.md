# Project phase records

This folder preserves completed phase requirements, implementation references,
rerun instructions, checkpoint results, and troubleshooting notes. Start here
when resuming work or reproducing a completed phase.

## Progress

| Phase | Scope | Status | Verified on | Records |
| --- | --- | --- | --- | --- |
| 01 | Local environment, database migrations, and protected seeding | Completed | 2026-11-04 | [Rerun guide](phase-01-local-setup/README.md), [verification](phase-01-local-setup/verification.md) |
| 02 | Test setup, database isolation, and initial frontend checks | Completed | 2026-11-04 | [Rerun guide](phase-02-test-setup/README.md), [verification](phase-02-test-setup/verification.md) |
| 03 | Authenticated persistent carts and session handling | Completed | 2026-11-04 | [Rerun guide](phase-03-authenticated-carts/README.md), [verification](phase-03-authenticated-carts/verification.md) |
| 04 | Guest and account product likes | Completed | 2026-11-04 | [Rerun guide](phase-04-product-likes/README.md), [verification](phase-04-product-likes/verification.md) |
| 05 | Exact money, historical orders, and safe checkout retries | Completed | 2026-11-04 | [Rerun guide](phase-05-order-integrity/README.md), [verification](phase-05-order-integrity/verification.md) |

Phase 01 is a retrospective record of the local setup completed before the
explicit Phase 2 checkpoint. Later phases will be added as their scope is agreed.
Dates in these records use Africa/Johannesburg time.

## Shared prerequisites

- Run commands from the repository root unless a guide explicitly changes directory.
- Use the checked-in `package-lock.json` files with `npm ci` to reproduce dependencies.
- The verified environment used Node.js `26.12.0` and npm `11.20.0`. Other versions
  must satisfy the installed dependencies' engine requirements.
- PowerShell examples use `npm.cmd` and `npx.cmd` to work on this Windows machine
  without changing its execution policy. On other platforms, use `npm` and `npx`.
- Run setup commands one at a time. A nonzero exit code must be resolved before
  proceeding to dependent commands.
- Install dependencies and Chromium when setting up a new machine. Normal test
  reruns do not require reinstalling dependencies or resetting the development database.

## Phase branches

Each completed phase has its own Git branch and implementation commit:

| Phase | Branch | Includes |
| --- | --- | --- |
| 01 | [phase/01-local-setup](https://github.com/JerivasioYawa/EbenStudios/tree/phase/01-local-setup) | Local configuration safeguards, protected seeding, and Phase 1 records |
| 02 | [phase/02-test-setup](https://github.com/JerivasioYawa/EbenStudios/tree/phase/02-test-setup) | Phase 1 plus the original API, component, and browser test setup |
| 03 | [phase/03-authenticated-carts](https://github.com/JerivasioYawa/EbenStudios/tree/phase/03-authenticated-carts) | Phases 1 and 2 plus authenticated persistent carts and session handling |
| 04 | [phase/04-product-likes](https://github.com/JerivasioYawa/EbenStudios/tree/phase/04-product-likes) | Earlier phases plus guest/account likes, login merging, and the liked-products page |
| 05 | [phase/05-order-integrity](https://github.com/JerivasioYawa/EbenStudios/tree/phase/05-order-integrity) | Earlier phases plus integer cents, safe historical conversion, immutable order details, stock integrity and checkout retries |

These branches are stacked in order. An earlier phase branch preserves the
implementation before later phase changes. The initial uncommitted work was
separated into phase commits using the source snapshots captured during the
completed work. No existing published history was rewritten.

To open a particular phase after its branch has been fetched:

```powershell
git fetch origin
git switch phase/05-order-integrity
```

Use that branch's rerun guide and lockfiles. Future phases get a new
`phase/NN-short-description` branch based on the latest completed phase. After the
checkpoint passes, commit the phase's implementation and records, then push its
branch with upstream tracking. The publication rules are in [AGENTS.md](../../AGENTS.md).

## Archive provenance

These initial records were created on **2026-11-04** from the working tree on
branch `improvement/auth-likes-admin-invoices`, based on commit
`216d7ce4874b1a1cf4735566408fbdd589f59d6a`.

The implementation and dependency changes were **not committed** when originally
verified. That base commit alone does not contain the completed phases. The phase
branches above now identify the separate implementation snapshots; the original
verification entries retain their historical source information.

The records contain summaries of checks actually run during this session.
Writing these documents did not rerun the application checks or copy private data.

## Recording the next phase

1. Copy [_template](./_template/README.md) into a descriptive, numbered directory:

   ```powershell
   Copy-Item -LiteralPath docs/phases/_template -Destination docs/phases/phase-06-short-name -Recurse
   ```

2. Fill in the phase title, requirements, file references, prerequisites, rerun
   steps, expected outputs, and checkpoint before starting its implementation.
3. Record actual verification in `verification.md`, including failures and their
   resolution. Use `git rev-parse HEAD` and `git status --short` to record source state.
4. Mark the phase completed when every required checkpoint is satisfied and add
   its row to the progress table above.
5. Append a new dated entry when rerunning or changing a completed phase. Update
   commands and the index if its current behavior changes.
6. Commit the verified phase files and records on its own branch, push that branch
   to `origin`, and verify the remote commit. Keep the previous phase branch intact.

Store environment variable names and safe examples here. Keep real credentials
in ignored local environment files. Generated reports, database files, uploads,
and `node_modules` stay in their normal ignored locations; reference relevant
results in the phase record.

The repository's [AGENTS.md](../../AGENTS.md) instructs future coding sessions to
maintain these records. The general test command reference is [TESTING.md](../../TESTING.md).
