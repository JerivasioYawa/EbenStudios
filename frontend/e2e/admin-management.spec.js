import { randomUUID } from "node:crypto";
import { test, expect, apiURL, loginAdmin, newCustomer } from "./support/fixtures.js";

async function adminSession(page) {
    await loginAdmin(page);
    const token = await page.evaluate(() => localStorage.getItem("eben_auth_token"));
    return { Authorization: `Bearer ${token}` };
}

test("admin searches and pages products, archives/restores and records stock reasons in history", async ({ page, request }) => {
    const headers = await adminSession(page), prefix = `Manage ${randomUUID()}`;
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text()); });
    const products = [];
    for (let index = 0; index < 12; index++) {
        const response = await request.post(`${apiURL}/products`, { headers, data: {
            name: `${prefix} ${index}`, price: "0.29", stock: index, lowStockThreshold: 3, tag: "Phase6",
        } });
        expect(response.status()).toBe(201); products.push(await response.json());
    }
    await page.getByRole("link", { name: "Products", exact: true }).click();
    await page.getByLabel("Search products").fill(prefix);
    await expect(page.getByRole("navigation", { name: "Pagination" })).toContainText("Page 1 of 2 · 12 records");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("row")).toHaveCount(3);
    await page.getByLabel("Stock filter").selectOption("low");
    await expect(page.getByRole("navigation", { name: "Pagination" })).toContainText("4 records");
    await page.getByLabel("Stock filter").selectOption("all");
    const target = products[1];
    await page.getByLabel("Search products").fill(target.name);
    // Match the complete cell, since the name ending in 1 also matches 10 and 11.
    const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: target.name, exact: true }) });
    await row.getByRole("button", { name: "Archive", exact: true }).click();
    await page.getByLabel("Reason", { exact: true }).fill("Season closed");
    await page.getByRole("button", { name: "Save Status", exact: true }).click();
    await expect(row).toHaveCount(0);
    expect((await request.get(`${apiURL}/products/${target.id}`)).status()).toBe(404);
    const customer = await request.post(`${apiURL}/auth/register`, { data: newCustomer() });
    const customerHeaders = { Authorization: `Bearer ${(await customer.json()).token}` };
    expect((await request.post(`${apiURL}/cart/items`, { headers: customerHeaders, data: { productId: target.id, quantity: 1 } })).status()).toBe(409);
    expect((await request.get(`${apiURL}/admin/products`, { headers: customerHeaders })).status()).toBe(403);
    await page.getByLabel("Visibility").selectOption("archived");
    await row.getByRole("button", { name: "Restore", exact: true }).click();
    await page.getByLabel("Reason", { exact: true }).fill("Season reopened");
    await page.getByRole("button", { name: "Save Status", exact: true }).click();
    await expect(row).toHaveCount(0);
    await page.getByLabel("Visibility").selectOption("active");
    await row.getByRole("button", { name: "Adjust Stock", exact: true }).click();
    await page.getByLabel("Stock adjustment", { exact: true }).fill("3");
    await page.getByLabel("Reason", { exact: true }).fill("Warehouse receipt PHASE6");
    await page.getByRole("button", { name: "Save Adjustment", exact: true }).click();
    await expect(row.getByRole("cell", { name: "4", exact: true })).toBeVisible();
    await row.getByRole("button", { name: "History", exact: true }).click();
    const history = page.getByRole("region", { name: "Product history", exact: true });
    await expect(history.getByText(/\+3.*Warehouse receipt PHASE6/)).toBeVisible();
    const record = await request.get(`${apiURL}/admin/products/${target.id}/history`, { headers });
    const entry = (await record.json()).adjustments.items[0];
    expect(entry).toMatchObject({ delta: 3, beforeStock: 1, afterStock: 4, reason: "Warehouse receipt PHASE6" });
    expect(entry.actorName).toBeTruthy(); expect(entry.createdAt).toBeTruthy();
    const publicProduct = await request.get(`${apiURL}/products/${target.id}`);
    expect((await publicProduct.json()).stock).toBe(4);
    expect(errors).toEqual([]);
    await page.screenshot({ path: "test-results/phase-06-products.png", fullPage: true });
});

test("admin confirms payment, cancels once, records a refund and sees accurate dashboard totals", async ({ page, request }) => {
    const headers = await adminSession(page), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text()); });
    const beforeResponse = await request.get(`${apiURL}/admin/dashboard`, { headers });
    const before = await beforeResponse.json();
    const created = await request.post(`${apiURL}/products`, { headers, data: { name: `Cancel ${randomUUID()}`, price: "10.00", stock: 4 } });
    expect(created.status()).toBe(201); const product = await created.json();
    const registration = await request.post(`${apiURL}/auth/register`, { data: newCustomer() });
    const customerHeaders = { Authorization: `Bearer ${(await registration.json()).token}` };
    expect((await request.post(`${apiURL}/cart/items`, { headers: customerHeaders, data: { productId: product.id, quantity: 2 } })).status()).toBe(200);
    const placed = await request.post(`${apiURL}/orders`, { headers: { ...customerHeaders, "Idempotency-Key": randomUUID() }, data: { shippingAddress: "6 Admin Test Road" } });
    expect(placed.status()).toBe(201); const order = await placed.json();
    const invalid = await request.patch(`${apiURL}/admin/orders/${order.id}/fulfilment`, { headers, data: { fulfilmentStatus: "Delivered" } });
    expect(invalid.status()).toBe(409);
    const pendingReport = await request.get(`${apiURL}/admin/dashboard`, { headers });
    expect((await pendingReport.json()).confirmedPaymentsCents).toBe(before.confirmedPaymentsCents);

    await page.goto(`/admin/orders?order=${order.id}`);
    const details = page.getByRole("region", { name: "Order details", exact: true });
    await expect(details.getByText("6 Admin Test Road", { exact: true })).toBeVisible();
    await expect(details.getByText("Unfulfilled", { exact: true })).toBeVisible();
    await page.getByLabel("Payment reference", { exact: true }).fill(`BANK-${randomUUID()}`);
    await page.getByRole("button", { name: "Confirm Payment", exact: true }).click();
    await page.getByRole("button", { name: "Start Processing", exact: true }).click();
    await expect(details.getByText("Processing", { exact: true })).toBeVisible();
    await page.getByLabel("Cancellation reason", { exact: true }).fill("Customer requested refund PHASE6");
    await page.getByRole("button", { name: "Cancel Order", exact: true }).click();
    await expect(details.getByText("RefundRequired", { exact: true })).toBeVisible();
    expect((await request.post(`${apiURL}/admin/orders/${order.id}/cancel`, { headers, data: { reason: "Retry" } })).status()).toBe(200);
    const stock = await request.get(`${apiURL}/products/${product.id}`);
    expect((await stock.json()).stock).toBe(4);
    const orderResponse = await request.get(`${apiURL}/admin/orders/${order.id}`, { headers });
    const cancelled = await orderResponse.json();
    expect(cancelled.history.filter(event => event.type === "Order cancelled")).toHaveLength(1);
    const cancelledReport = await request.get(`${apiURL}/admin/dashboard`, { headers });
    const report = await cancelledReport.json();
    expect(report.confirmedPaymentsCents).toBe(before.confirmedPaymentsCents);
    expect(BigInt(report.awaitingRefundCents)).toBe(BigInt(before.awaitingRefundCents) + 2000n);
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    const confirmedCard = page.getByRole("heading", { name: "Confirmed payments", exact: true }).locator("..");
    const expected = (BigInt(before.confirmedPaymentsCents) / 100n).toLocaleString("en-US") + "." + (BigInt(before.confirmedPaymentsCents) % 100n).toString().padStart(2, "0");
    await expect(confirmedCard).toContainText(`R ${expected}`);

    await page.goto(`/admin/orders?order=${order.id}`);
    await page.getByLabel("Refund reference", { exact: true }).fill(`REFUND-${randomUUID()}`);
    await page.getByRole("button", { name: "Record Refund", exact: true }).click();
    await expect(details.getByText("Refunded", { exact: true })).toBeVisible();
    const finalResponse = await request.get(`${apiURL}/admin/dashboard`, { headers });
    const final = await finalResponse.json();
    expect(final.confirmedPaymentsCents).toBe(before.confirmedPaymentsCents);
    expect(final.awaitingRefundCents).toBe(before.awaitingRefundCents);
    expect(BigInt(final.refundedCents)).toBe(BigInt(before.refundedCents) + 2000n);
    const history = await request.get(`${apiURL}/orders/mine`, { headers: customerHeaders });
    expect((await history.json())[0]).toMatchObject({ totalCents: 2000, status: "Cancelled", paymentStatus: "Refunded" });
    expect(errors).toEqual([]);
    await page.screenshot({ path: "test-results/phase-06-order.png", fullPage: true });
});
