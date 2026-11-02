# Publish the improvement branch

The GitHub connector returned HTTP 403 Resource not accessible by integration when asked to create the branch. The local branch contains the prepared changes. Do not assume the remote has been updated unless the final handover confirms a successful push.

## Option A Publish from an existing local clone using the supplied bundle

Place EbenStudios_term4.bundle somewhere outside your repository, then open PowerShell in your existing EbenStudios clone.

```powershell
git status --short
git remote -v
```

Preserve unrelated changes first. Confirm origin is https://github.com/JerivasioYawa/EbenStudios.git. Replace the example bundle location below with your downloaded path.

```powershell
$bundle = "$env:USERPROFILE\Downloads\EbenStudios_term4.bundle"
git bundle verify $bundle
git fetch $bundle improvement/term4-completion:improvement/term4-completion
git switch improvement/term4-completion
git log -3 --oneline
```

If the local branch name already exists, inspect it first. Import to a separate branch rather than overwriting it:

```powershell
git fetch $bundle improvement/term4-completion:review/term4-import
git switch review/term4-import
```

Run LOCAL-SETUP.md and all acceptance checks. Then publish the current reviewed branch to the intended remote branch:

```powershell
git push -u origin HEAD:improvement/term4-completion
```

Use your normal Git Credential Manager sign-in. Do not paste a PAT into commands, the README, or a chat message. If push is denied, check account/repository access in GitHub settings.

## Option B Start a separate working copy

```powershell
git clone --branch improvement/term4-completion "$env:USERPROFILE\Downloads\EbenStudios_term4.bundle" EbenStudios-Term4
Set-Location EbenStudios-Term4
git remote set-url origin https://github.com/JerivasioYawa/EbenStudios.git
```

Follow local setup, then push using the command above. The bundle includes Git history and the improvement branch, excluding local .env files, databases, uploads and node_modules.

## Open and review a pull request

Open https://github.com/JerivasioYawa/EbenStudios/compare/main...improvement/term4-completion after a successful push. Use main as the base and improvement/term4-completion as the compare branch. Suggested title: Complete local order integrity and Term 4 implementation phases.

Include the actual test results and remaining browser/deployment limitations from docs/testing/RESULTS.md. The Application checks workflow should run backend tests and frontend lint/build. Inspect the actual Actions run; a configured workflow is not a passing run. Review source changes and the eight phase folders before merging.

If main advanced meanwhile, fetch it and merge it into your improvement branch deliberately, resolve conflicts, and rerun checks. Never force-push main or replace unrelated team work.
