# Phase 06 Accessible controls and constrained uploads

## Files and purpose

- `frontend/src/components/layout/MobileMenu.jsx`
- `frontend/src/components/admin/AdminLayout.jsx`
- `frontend/src/pages/Register.jsx`
- `frontend/src/index.css`
- `backend/src/middleware/upload.js`

## Implementation steps

1. Add visible labels to account forms and visible keyboard focus. Use native buttons for menu controls.
2. Use a native modal dialog for mobile navigation and include Cart/Profile/My orders. Escape closes the dialog; verify focus returns to the trigger.
3. Stack the administration layout on narrow screens and allow table scrolling without forcing the whole page wider.
4. Limit uploads to one 5 MB JPEG/PNG/GIF/WebP, randomize filenames with server-selected extension, check signatures and remove failed uploads.
5. Set nosniff on server responses. Treat image header validation as an initial check, not full image decoding or malware screening.
6. Complete keyboard, 390 px and 200% zoom checks in MANUAL-CHECKLIST.md. Do not invent an accessibility percentage.

## Checkpoint commands

```powershell
npm --prefix backend run test:integration
npm --prefix frontend run lint
npm --prefix frontend run build
```

## Pass condition

Upload spoof/size/cleanup tests pass. Browser keyboard, focus, zoom and responsive evidence remains pending local execution.

## If a checkpoint fails

Preserve failing upload cases as non-sensitive fixtures. Fix controls without removing keyboard access. Full WCAG conformance is not established.

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
