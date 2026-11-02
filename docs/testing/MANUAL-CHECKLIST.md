# Browser acceptance checklist

Status: NOT RUN in the authoring environment. Chromium launch was denied and alternate browser initialization failed. Run against the local demo application, record date/browser, observed result and PASS/FAIL for each case. Screenshots must contain only synthetic accounts and no tokens/passwords.

| ID | Action | Expected result |
| --- | --- | --- |
| B01 | Home and Shop, then search a known name | API-backed products and matching results; no invented IDs |
| B02 | Disconnect API, open Home/Cart, reconnect and retry | Useful error; basket selections preserved; retry succeeds |
| B03 | Register invalid email/short password, then valid account | Validation feedback; valid account enters customer flow |
| B04 | Add hoodie, open Cart/Checkout, place order | Current cents/stock, required address, confirmed order ID and empty cart |
| B05 | Inspect checkout Network request; retry same request | Idempotency-Key present; same order ID, no second stock deduction |
| B06 | Change catalogue price, reload Cart | Fresh price shown; server total authoritative |
| B07 | Archive cart product or reduce stock below quantity | Warning; checkout blocked until line removed/quantity corrected |
| B08 | Admin edits description/tag to blank | Fields remain cleared after reload |
| B09 | Archive and restore product | Hidden publicly, preserved history, same ID on restore |
| B10 | Pending→Cancelled twice and inspect stock | Stock restored once only |
| B11 | Pending→Paid→Shipped→Delivered | Only valid choices shown; no backward transition |
| B12 | Rename/reprice previously purchased item | Customer order still shows purchased name and unit cents |
| B13 | Upload valid image, spoofed text and >5 MB file | Valid image visible; invalid files rejected with feedback |
| B14 | At 390 px open menu, Cart/Profile/Orders and admin screens | Controls reachable, no page-wide overflow; tables may scroll |
| B15 | Keyboard only; open/close mobile dialog with Escape | Visible focus, usable controls, focus restored to trigger |
| B16 | 200% zoom, account forms, errors and status controls | Readable labels/messages; no important clipped controls |
| B17 | Customer opens admin route and calls admin API | UI guard; API 403 regardless of hidden buttons |
| B18 | Refresh /shop and /login on deployed preview later | Application screen rather than Vercel 404 |

Automated smoke: from frontend run `npx playwright install chromium`, then `npm run test:browser`, with both servers running. It creates a synthetic account/order and stores screenshots in ignored test-results. It does not certify admin usability or accessibility conformance.
