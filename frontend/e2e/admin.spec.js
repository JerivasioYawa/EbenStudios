import { randomUUID } from "node:crypto";
import { test, expect, apiURL, productImage, loginAdmin, login, newCustomer } from "./support/fixtures.js";

test("admin logs in, creates and edits a product with an image, then deletes it", async ({ page }) => {
    const name = `Browser Tee ${randomUUID()}`;
    await loginAdmin(page);
    await page.getByRole("link", { name: "Products", exact: true }).click();
    await page.getByRole("button", { name: "Add Product", exact: true }).click();
    await page.getByPlaceholder("Name", { exact: true }).fill(name);
    await page.getByPlaceholder("Price", { exact: true }).fill("750");
    await page.getByPlaceholder("Stock", { exact: true }).fill("5");
    await page.getByPlaceholder("Description", { exact: true }).fill("Created by the browser journey test.");
    await page.getByLabel("Upload Image").setInputFiles({ name: "tee.png", mimeType: "image/png", buffer: productImage });
    await page.getByRole("button", { name: "Create Product", exact: true }).click();

    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row.getByRole("img", { name, exact: true })).toHaveAttribute("src", /\/uploads\//);
    await page.reload();
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByPlaceholder("Price", { exact: true }).fill("799");
    await page.getByPlaceholder("Stock", { exact: true }).fill("6");
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(row.getByRole("cell", { name: "R 799", exact: true })).toBeVisible();
    await page.reload();
    await expect(row.getByRole("cell", { name: "6", exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Delete", exact: true }).click();
    await row.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(row).toHaveCount(0);
    await page.getByRole("button", { name: "Log Out", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    const catalogueResponse = page.waitForResponse((response) =>
        response.url() === `${apiURL}/products` && response.request().method() === "GET");
    await page.goto("/shop");
    const catalogue = await catalogueResponse;
    expect(catalogue.status()).toBe(200);
    expect((await catalogue.json()).some((product) => product.name === name)).toBe(false);
    await expect(page.getByRole("heading", { name: "Shop", level: 1, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(0);
});

test("admin fulfils an order and the customer sees the persisted status", async ({ page, request }) => {
    const customer = newCustomer();
    const registration = await request.post(`${apiURL}/auth/register`, { data: customer });
    expect(registration.status()).toBe(201);
    const { token } = await registration.json();
    const catalogue = await request.get(`${apiURL}/products`);
    const product = (await catalogue.json()).find((item) => item.name === "Movement Cap");
    const placed = await request.post(`${apiURL}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { items: [{ productId: product.id, quantity: 1 }], shippingAddress: "20 Test Road, Cape Town, 8001" },
    });
    expect(placed.status()).toBe(201);
    const order = await placed.json();

    await loginAdmin(page);
    await page.getByRole("link", { name: "Orders", exact: true }).click();
    const row = page.getByRole("row").filter({ hasText: `#EB-${order.id}` });
    await expect(row).toBeVisible();
    const statusResponse = page.waitForResponse((response) =>
        response.url() === `${apiURL}/orders/${order.id}/status` && response.request().method() === "PATCH");
    await row.getByRole("combobox").selectOption("Shipped");
    expect((await statusResponse).status()).toBe(200);
    await page.reload();
    await expect(row.getByRole("combobox")).toHaveValue("Shipped");
    await page.getByRole("button", { name: "Log Out", exact: true }).click();
    await login(page, customer);
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/orders");
    await expect(page.getByText(`#EB-${order.id}`, { exact: true })).toBeVisible();
    await expect(page.getByText("Shipped", { exact: true })).toBeVisible();
});
