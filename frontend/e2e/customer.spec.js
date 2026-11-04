import { test, expect, apiURL, registerCustomer, login } from "./support/fixtures.js";

test("customer registers, logs back in, shops, checks out, and sees their order", async ({ page, request }) => {
    const customer = await registerCustomer(page);
    await page.getByRole("link", { name: "Profile", exact: true }).click();
    await expect(page.getByText(customer.email, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Log Out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await login(page, customer);
    await expect(page).toHaveURL(/\/$/);

    const catalogue = await request.get(`${apiURL}/products`);
    const hoodie = (await catalogue.json()).find((product) => product.name === "Woodstock Hoodie");
    await page.goto("/shop");
    await page.getByRole("heading", { name: "Woodstock Hoodie", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Woodstock Hoodie", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
    await page.getByRole("link", { name: "Cart", exact: true }).click();
    const quantityResponse = page.waitForResponse((response) =>
        response.url() === `${apiURL}/cart/items/${hoodie.id}` && response.request().method() === "PATCH");
    await page.getByRole("button", { name: "Increase quantity", exact: true }).click();
    expect((await quantityResponse).status()).toBe(200);
    await expect(page.getByRole("button", { name: "Increase quantity", exact: true })).toBeEnabled();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Woodstock Hoodie", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Proceed to Checkout", exact: true }).click();
    await page.getByPlaceholder("Street Address", { exact: true }).fill("10 Test Street");
    await page.getByPlaceholder("City", { exact: true }).fill("Cape Town");
    await page.getByPlaceholder("Postal Code", { exact: true }).fill("8001");

    const orderResponse = page.waitForResponse((response) =>
        response.url() === `${apiURL}/orders` && response.request().method() === "POST");
    await page.getByRole("button", { name: /^Place Order/ }).click();
    const response = await orderResponse;
    expect(response.status()).toBe(201);
    const order = await response.json();
    expect(order.total).toBe(2398);
    expect(order.items[0].quantity).toBe(2);
    expect(order.shippingAddress).toBe("10 Test Street, Cape Town, 8001");
    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.getByText(`Order #EB-${order.id} placed successfully!`, { exact: true })).toBeVisible();
    await expect(page.getByText("Pending", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(`#EB-${order.id}`, { exact: true })).toBeVisible();

    const stock = await request.get(`${apiURL}/products/${order.items[0].productId}`);
    expect((await stock.json()).stock).toBe(hoodie.stock - 2);
    await page.goto("/cart");
    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
});

test("guests and customers cannot enter the admin area", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/admin/products");
    await expect(page).toHaveURL(/\/admin\/login$/);

    const customer = await registerCustomer(page);
    await page.goto("/admin/products");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await login(page, customer, "/admin/login");
    await expect(page.getByText("This account does not have admin access.", { exact: true })).toBeVisible();
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login$/);
});

test("shows a useful error when login credentials are incorrect", async ({ page }) => {
    await login(page, { email: "missing@eben.test", password: "invalid-test-password" });
    await expect(page.getByText("Invalid email or password", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
});
