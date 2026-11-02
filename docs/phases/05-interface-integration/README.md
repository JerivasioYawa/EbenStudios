# Phase 05 Customer and administrator integration

## Files and purpose

- `frontend/src/context/CartContext.jsx`
- `frontend/src/components/home/FeaturedProducts.jsx`
- `frontend/src/pages/Orders.jsx`
- `frontend/src/pages/admin/Products.jsx`
- `frontend/src/pages/admin/Orders.jsx`
- `frontend/src/pages/admin/Dashboard.jsx`

## Implementation steps

1. Load featured products from the active API catalogue with loading, retry and empty states.
2. Store cart selections as IDs/quantities. Reconcile them with current catalogue data and flag archived or excessive-stock lines. Preserve selections if the API fails.
3. Calculate estimates in cents and format only at display. Use purchase-time names/unit cents in order history.
4. Send empty description/tag fields intentionally so administrators can clear them. Add archived product listing and Restore actions.
5. Offer only valid status transitions. Sum Paid/Shipped/Delivered cents as Paid order value; show it is not verified settlement.
6. Connect product search to shop name/tag filtering. Remove the unsupported category/newsletter controls from Home.
7. Run customer and administrator manual journeys; build success alone is not UI acceptance.

## Checkpoint commands

```powershell
npm --prefix frontend run lint
npm --prefix frontend run build
# With both local servers running:
npm --prefix frontend run test:browser
```

## Pass condition

Build/lint pass. Browser gate remains pending here: verify current cart prices, stable checkout, accurate history, archive/restore and cleared optional text locally.

## If a checkpoint fails

Record failed screen/network behaviour and fix the integration; do not substitute hardcoded prices or fake confirmation screens.

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
