# Phase 03 Reliable checkout and order lifecycle

## Files and purpose

- `backend/src/services/order.service.js`
- `backend/src/routes/order.routes.js`
- `frontend/src/service/orderService.js`
- `frontend/src/pages/Checkout.jsx`

## Implementation steps

1. Validate and combine duplicate product lines. Retrieve current prices from the database.
2. Create order/items and decrement stock in one transaction using conditional stock updates.
3. Hash canonical user/items/address and save a unique checkout reference. Same reference/content replays; changed content or owner conflicts.
4. Pass the actual Idempotency-Key header from the frontend service. Store the attempt before sending, and retain it after an uncertain result.
5. Enforce Pending→Paid/Cancelled, Paid→Shipped, Shipped→Delivered. Repeated same status is harmless; cancellation restores stock once.
6. Clear the basket only after confirmation. Paid is not automatic payment verification.

## Checkpoint commands

```powershell
npm --prefix backend run test:integration
npm --prefix frontend run build
```

## Pass condition

Replay returns same order ID; changed key content conflicts; rollback leaves stock intact; one of two buyers gets the last item; repeated cancellation does not add stock twice.

## If a checkpoint fails

Do not retry a network-uncertain checkout with a new key. Inspect order history first. Preserve the original request for replay.

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
