import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { readPdf } from "../../backend/test-support/read-pdf.js";
import { test, expect, apiURL, loginAdmin, login, newCustomer, registerCustomer } from "./support/fixtures.js";

async function admin(page) {
    await loginAdmin(page);
    return { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("eben_auth_token"))}` };
}
async function checkout(request, products, quantity) {
    const customer = newCustomer(), registration = await request.post(`${apiURL}/auth/register`, { data: customer });
    expect(registration.status()).toBe(201);
    const customerHeaders = { Authorization: `Bearer ${(await registration.json()).token}` };
    for (const product of products) expect((await request.post(`${apiURL}/cart/items`, { headers: customerHeaders, data: { productId: product.id, quantity } })).status()).toBe(200);
    const response = await request.post(`${apiURL}/orders`, { headers: { ...customerHeaders, "Idempotency-Key": randomUUID() }, data: { shippingAddress: "7 Customer Billing Road, Cape Town" } });
    expect(response.status()).toBe(201);
    return { order: await response.json(), customer, customerHeaders };
}
async function issueFromUi(page, order) {
    await page.goto(`/admin/orders?order=${order.id}`);
    await page.getByRole("button", { name: "Prepare Invoice", exact: true }).click();
    await expect(page.getByLabel("Billing address", { exact: true })).toHaveValue(order.shippingAddress);
    const created = page.waitForResponse(response => response.url() === `${apiURL}/orders/${order.id}/invoice` && response.request().method() === "POST");
    await page.getByRole("button", { name: "Issue Invoice", exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    const invoice = await response.json();
    await expect(page).toHaveURL(new RegExp(`/admin/invoices\\?invoice=${invoice.id}$`));
    await expect(page.getByRole("heading", { name: invoice.number, exact: true })).toBeVisible();
    return invoice;
}
async function download(page, invoice) {
    const result = page.waitForEvent("download");
    const response = page.waitForResponse(response => response.url() === `${apiURL}/invoices/${invoice.id}/pdf`);
    await page.getByRole("button", { name: "Download PDF", exact: true }).click();
    const file = await result;
    expect(file.suggestedFilename()).toBe(invoice.number + ".pdf");
    expect((await response).headers()["cache-control"]).toBe("private, no-store");
    const bytes = await readFile(await file.path());
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    return { bytes, pages: await readPdf(bytes) };
}

test("admin issues and corrects an invoice; its customer downloads it and a changed invoice URL stays private", async ({ page, request }) => {
    test.setTimeout(60_000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text()); });
    const headers = await admin(page), name = `Invoice Tee ${randomUUID()}`;
    const created = await request.post(`${apiURL}/products`, { headers, data: { name, price: "0.29", stock: 3 } });
    expect(created.status()).toBe(201); const product = await created.json();
    const { order, customer } = await checkout(request, [product], 3);
    const invoice = await issueFromUi(page, order);
    expect(invoice.totalCents).toBe(87);
    const detail = page.getByRole("region", { name: "Invoice details", exact: true });
    await expect(detail.getByText("Invoice total: R 0.87", { exact: true })).toBeVisible();
    const pdf = await download(page, invoice);
    expect(pdf.pages[0].text).toMatch(/Invoice total\s+R 0\.87/);
    const replay = await request.post(`${apiURL}/orders/${order.id}/invoice`, { headers, data: {} });
    expect(replay.status()).toBe(200); expect((await replay.json()).id).toBe(invoice.id);
    const current = await request.get(`${apiURL}/admin/orders/${order.id}`, { headers });
    expect((await current.json()).paymentStatus).toBe("Pending");
    expect((await request.put(`${apiURL}/products/${product.id}`, { headers, data: { name: `Changed ${name}`, price: "9.99" } })).status()).toBe(200);
    await page.reload(); await expect(detail.getByText(name, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Correct Details", exact: true }).click();
    await page.getByLabel("Billing address", { exact: true }).fill("Corrected Customer Billing Address");
    await page.getByLabel("Correction reason", { exact: true }).fill("Customer billing address corrected");
    const corrected = page.waitForResponse(response => response.url() === `${apiURL}/invoices/${invoice.id}/corrections` && response.request().method() === "POST");
    await page.getByRole("button", { name: "Issue Replacement", exact: true }).click();
    const correctionResponse = await corrected; expect(correctionResponse.status()).toBe(201);
    const replacement = await correctionResponse.json(); expect(replacement.number).not.toBe(invoice.number);
    await expect(page.getByRole("heading", { name: replacement.number, exact: true })).toBeVisible();
    await expect(detail.getByText("Corrected Customer Billing Address", { exact: true })).toBeVisible();
    const previous = await request.get(`${apiURL}/invoices/${invoice.id}`, { headers });
    expect((await previous.json()).status).toBe("Voided");
    await page.getByRole("button", { name: "Log Out", exact: true }).click();
    await login(page, customer); await expect(page).toHaveURL(/\/$/);
    await page.goto("/orders");
    await page.getByRole("link", { name: "View invoices", exact: true }).click();
    await page.getByRole("row").filter({ hasText: replacement.number }).getByRole("link", { name: "View Invoice", exact: true }).click();
    await expect(detail.getByText("Corrected Customer Billing Address", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Correct Details", exact: true })).toHaveCount(0);
    const customerPdf = await download(page, replacement);
    expect(customerPdf.pages[0].text).toContain("Corrected Customer Billing Address");
    expect(customerPdf.pages[0].text).toMatch(/Invoice total\s+R 0\.87/);
    await page.screenshot({ path: "test-results/phase-07-customer-invoice.png", fullPage: true });
    await page.getByRole("link", { name: "Profile", exact: true }).click();
    await page.getByRole("button", { name: "Log Out", exact: true }).click();
    await registerCustomer(page);
    await page.goto(`/invoices/${replacement.id}`);
    await expect(page.getByRole("alert")).toContainText("Invoice not found");
    await expect(page.getByRole("button", { name: "Download PDF", exact: true })).toHaveCount(0);
    await expect(page.getByText("Corrected Customer Billing Address", { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
});

test("a long invoice downloads as complete numbered pages and a reasoned void retains a marked PDF", async ({ page, request }) => {
    test.setTimeout(60_000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text()); });
    const headers = await admin(page), prefix = `Long Invoice ${randomUUID()}`, products = [];
    for (let index = 0; index < 25; index++) {
        const response = await request.post(`${apiURL}/products`, { headers, data: { name: `${prefix} ${index + 1}`, description: "Saved long-order description. ".repeat(15), price: "0.29", stock: 3 } });
        expect(response.status()).toBe(201); products.push(await response.json());
    }
    const { order } = await checkout(request, products, 3), invoice = await issueFromUi(page, order);
    expect(invoice.totalCents).toBe(2175);
    const pdf = await download(page, invoice), text = pdf.pages.map(page => page.text).join(" ");
    expect(pdf.pages.length).toBeGreaterThan(3);
    // Read the description column in visual order; numeric columns are separate PDF text runs.
    const descriptions = pdf.pages.flatMap(page => page.items.filter(item => item.transform[4] >= 44 && item.transform[4] < 290
        && item.str !== "Item / description" && !/^Item \d+ \(continued\)$/.test(item.str)).map(item => item.str)).join(" ").replace(/\s+/g, " ");
    for (const product of products) expect(descriptions).toContain(product.name);
    for (let index = 0; index < pdf.pages.length; index++) expect(pdf.pages[index].text).toContain(`Page ${index + 1} of ${pdf.pages.length}`);
    expect(text).toMatch(/Invoice total\s+R 21\.75/);
    await writeFile("test-results/phase-07-long-invoice.pdf", pdf.bytes);
    await page.getByRole("button", { name: "Void Invoice", exact: true }).click();
    await page.getByLabel("Void reason", { exact: true }).fill("Invoice issued in error during browser test");
    await page.getByRole("button", { name: "Confirm Void", exact: true }).click();
    await expect(page.getByRole("region", { name: "Invoice details", exact: true }).getByText("Voided", { exact: true })).toBeVisible();
    const voided = await download(page, invoice);
    expect(voided.pages[0].text).toContain("VOIDED INVOICE");
    expect(voided.pages.map(page => page.text).join(" ")).toMatch(/Invoice total\s+R 21\.75/);
    const current = await request.get(`${apiURL}/admin/orders/${order.id}`, { headers });
    expect((await current.json()).paymentStatus).toBe("Pending");
    expect(errors).toEqual([]);
});
