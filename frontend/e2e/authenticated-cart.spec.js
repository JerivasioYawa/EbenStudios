import { createHmac } from "node:crypto";
import { test, expect, apiURL, newCustomer, registerCustomer, login } from "./support/fixtures.js";

async function fillLogin(page, customer) {
    await page.getByPlaceholder("Email", { exact: true }).fill(customer.email);
    await page.getByPlaceholder("Password", { exact: true }).fill(customer.password);
    await page.getByRole("button", { name: "Log In", exact: true }).click();
}

async function openProduct(page, name) {
    await page.goto("/shop");
    await page.getByRole("heading", { name, exact: true }).click();
    await expect(page.getByRole("heading", { name, level: 1, exact: true })).toBeVisible();
}

async function logout(page) {
    await page.goto("/profile");
    await page.getByRole("button", { name: "Log Out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
}

test("guest cart actions request login, preserve the product URL, and do not auto-add", async ({ page, request }) => {
    const customer = newCustomer();
    const registration = await request.post(`${apiURL}/auth/register`, { data: customer });
    expect(registration.status()).toBe(201);
    const { token } = await registration.json();
    const headers = { Authorization: `Bearer ${token}` };

    for (const route of ["/cart", "/checkout"]) {
        await page.goto(route);
        await expect(page).toHaveURL(/\/login$/);
    }
    const guestRequest = await request.post(`${apiURL}/cart/items`, { data: { productId: 1, quantity: 1 } });
    expect(guestRequest.status()).toBe(401);
    await openProduct(page, "Woodstock Hoodie");
    const productURL = page.url() + "?source=shop#details";
    await page.goto(productURL);
    const mutations = [];
    page.on("request", (outgoing) => {
        if (outgoing.url() === `${apiURL}/cart/items` && outgoing.method() === "POST") mutations.push(outgoing);
    });
    await page.getByRole("button", { name: "Log in to add to cart.", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(mutations).toHaveLength(0);
    const empty = await request.get(`${apiURL}/cart`, { headers });
    expect((await empty.json()).items).toEqual([]);

    await fillLogin(page, customer);
    await expect(page).toHaveURL(productURL);
    await expect(page.getByRole("button", { name: "Add to Cart", exact: true })).toBeEnabled();
    expect(mutations).toHaveLength(0);
    await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
    await expect(page.getByRole("button", { name: "Added to Cart", exact: true })).toBeVisible();
    const saved = await request.get(`${apiURL}/cart`, { headers });
    expect((await saved.json()).items).toEqual([expect.objectContaining({ name: "Woodstock Hoodie", quantity: 1 })]);
});

test("logging out clears active state and each account restores only its saved cart", async ({ page }) => {
    const customerA = await registerCustomer(page);
    await openProduct(page, "Movement Cap");
    await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
    await expect(page.getByRole("button", { name: "Added to Cart", exact: true })).toBeVisible();
    await logout(page);
    await expect(page.getByRole("link", { name: "Cart", exact: true })).toHaveText("");

    const customerB = await registerCustomer(page);
    await page.goto("/cart");
    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Movement Cap", exact: true })).toHaveCount(0);
    await openProduct(page, "Streets Tee");
    await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
    await expect(page.getByRole("button", { name: "Added to Cart", exact: true })).toBeVisible();
    await logout(page);

    await login(page, customerA);
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Movement Cap", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Streets Tee", exact: true })).toHaveCount(0);
    await logout(page);
    await login(page, customerB);
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Streets Tee", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Movement Cap", exact: true })).toHaveCount(0);
});

test("an expired session fails the cart action, requests login, and leaves the saved cart unchanged", async ({ page, request }) => {
    const customer = await registerCustomer(page);
    await openProduct(page, "Woodstock Hoodie");
    const productURL = page.url();
    await expect(page.getByRole("button", { name: "Add to Cart", exact: true })).toBeEnabled();
    const token = await page.evaluate(() => localStorage.getItem("eben_auth_token"));
    const [header, encodedPayload] = token.split(".");
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString());
    payload.exp = Math.floor(Date.now() / 1000) - 60;
    const unsigned = `${header}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
    const expired = `${unsigned}.${createHmac("sha256", process.env.E2E_SERVER_TOKEN).update(unsigned).digest("base64url")}`;
    // Keep the mounted UI authenticated so the real API, rather than a page reload, rejects the action.
    await page.evaluate((value) => localStorage.setItem("eben_auth_token", value), expired);
    const rejected = page.waitForResponse((response) =>
        response.url() === `${apiURL}/cart/items` && response.request().method() === "POST");
    await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
    expect((await rejected).status()).toBe(401);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("alert")).toHaveText("Your session has expired. Please log in again.");
    expect(await page.evaluate(() => localStorage.getItem("eben_auth_token"))).toBeNull();
    const saved = await request.get(`${apiURL}/cart`, { headers: { Authorization: `Bearer ${token}` } });
    expect((await saved.json()).items).toEqual([]);
    await fillLogin(page, customer);
    await expect(page).toHaveURL(productURL);
    await page.getByRole("link", { name: "Cart", exact: true }).click();
    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
});
