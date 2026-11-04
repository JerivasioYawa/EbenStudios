import { randomUUID } from "node:crypto";
import { test, expect, apiURL, registerCustomer } from "./support/fixtures.js";

test("R0.29 times three survives a lost receipt, retries once, and keeps historical details", async ({ page, request }) => {
    const adminLogin = await request.post(`${apiURL}/auth/login`, { data: {
        email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD,
    } });
    expect(adminLogin.status()).toBe(200);
    const adminHeaders = { Authorization: `Bearer ${(await adminLogin.json()).token}` };
    const name = `Cent Test ${randomUUID()}`;
    const created = await request.post(`${apiURL}/products`, {
        headers: adminHeaders, data: { name, description: "Original details", price: "0.29", stock: 3 },
    });
    expect(created.status()).toBe(201);
    const product = await created.json();
    expect(product.priceCents).toBe(29);

    await registerCustomer(page);
    await page.goto(`/products/${product.id}`);
    await expect(page.getByText("R 0.29", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
    await page.getByRole("link", { name: "Cart", exact: true }).click();
    for (const quantity of [2, 3]) {
        const saved = page.waitForResponse(response => response.url() === `${apiURL}/cart/items/${product.id}`
            && response.request().method() === "PATCH");
        await page.getByRole("button", { name: "Increase quantity", exact: true }).click();
        expect((await saved).status()).toBe(200);
        await expect(page.getByRole("button", { name: "Increase quantity", exact: true })).toBeEnabled();
        await expect(page.getByRole("main").getByText(String(quantity), { exact: true })).toBeVisible();
    }
    await expect(page.getByText("R 0.87", { exact: true })).toHaveCount(2);
    await page.getByRole("link", { name: "Proceed to Checkout", exact: true }).click();
    await page.getByPlaceholder("Street Address", { exact: true }).fill("29 Cent Road");
    await page.getByPlaceholder("City", { exact: true }).fill("Cape Town");
    await page.getByPlaceholder("Postal Code", { exact: true }).fill("8001");

    const keys = [];
    let committed;
    await page.route(`${apiURL}/orders`, async route => {
        if (route.request().method() !== "POST") return route.continue();
        keys.push(route.request().headers()["idempotency-key"]);
        const response = await route.fetch(); // Real API and database commit, including stock reduction.
        if (keys.length === 1) {
            expect(response.status()).toBe(201);
            committed = await response.json();
            await route.fulfill({ status: 503, json: { message: "Response lost. Please retry." } });
        } else {
            expect(response.status()).toBe(200);
            expect(response.headers()["idempotency-replayed"]).toBe("true");
            await route.fulfill({ response });
        }
    });
    const placeOrder = page.getByRole("button", { name: /^Place Order.*R 0\.87$/ });
    await placeOrder.click();
    await expect(page.getByRole("alert")).toHaveText("Response lost. Please retry.");
    await placeOrder.click();
    await expect(page).toHaveURL(/\/orders$/);
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    expect(committed.totalCents).toBe(87);
    expect(committed.items[0]).toMatchObject({ quantity: 3, unitPriceCents: 29, lineTotalCents: 87, productName: name });

    const token = await page.evaluate(() => localStorage.getItem("eben_auth_token"));
    const customerHeaders = { Authorization: `Bearer ${token}` };
    const orders = await request.get(`${apiURL}/orders/mine`, { headers: customerHeaders });
    expect(await orders.json()).toEqual([committed]);
    const stock = await request.get(`${apiURL}/products/${product.id}`);
    expect((await stock.json()).stock).toBe(0);
    const cart = await request.get(`${apiURL}/cart`, { headers: customerHeaders });
    expect((await cart.json()).items).toEqual([]);

    const updated = await request.put(`${apiURL}/products/${product.id}`, {
        headers: adminHeaders, data: { name: `Changed ${name}`, description: "Changed details", price: "9.99" },
    });
    expect(updated.status()).toBe(200);
    await page.reload();
    await expect(page.getByText(name + " × 3", { exact: true })).toBeVisible();
    await expect(page.getByText("R 0.87", { exact: true })).toHaveCount(2);
    const unchanged = await request.get(`${apiURL}/orders/mine`, { headers: customerHeaders });
    expect(await unchanged.json()).toEqual([committed]);

    const deleted = await request.delete(`${apiURL}/products/${product.id}`, { headers: adminHeaders });
    expect(deleted.status()).toBe(204);
    await page.reload();
    await expect(page.getByText(name + " × 3", { exact: true })).toBeVisible();
    const historical = await request.get(`${apiURL}/orders/mine`, { headers: customerHeaders });
    const retained = (await historical.json())[0];
    expect(retained.items[0]).toMatchObject({ productId: null, productName: name, lineTotalCents: 87 });
    expect(retained.totalCents).toBe(87);
});
