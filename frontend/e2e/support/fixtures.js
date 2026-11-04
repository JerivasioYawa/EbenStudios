import { randomBytes, randomUUID } from "node:crypto";
import { test as base, expect } from "@playwright/test";

export { expect };
export const apiURL = `http://127.0.0.1:${process.env.E2E_API_PORT || "4100"}/api`;
export const productImage = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=", "base64",
);

export const test = base.extend({
    page: async ({ page }, runTest) => {
        // Remote placeholder images must not make application tests depend on an external image host.
        await page.route("https://picsum.photos/**", (route) => route.fulfill({
            contentType: "image/png", body: productImage,
        }));
        await runTest(page);
    },
});

export function newCustomer() {
    return { name: "Browser Customer", email: `${randomUUID()}@eben.test`, password: randomBytes(24).toString("hex") };
}

export async function registerCustomer(page, customer = newCustomer()) {
    await page.goto("/register");
    await page.getByPlaceholder("Full name", { exact: true }).fill(customer.name);
    await page.getByPlaceholder("Email", { exact: true }).fill(customer.email);
    await page.getByPlaceholder("Password", { exact: true }).fill(customer.password);
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    return customer;
}

export async function login(page, credentials, url = "/login") {
    await page.goto(url);
    await page.getByPlaceholder("Email", { exact: true }).fill(credentials.email);
    await page.getByPlaceholder("Password", { exact: true }).fill(credentials.password);
    await page.getByRole("button", { name: "Log In", exact: true }).click();
}

export async function loginAdmin(page) {
    await login(page, {
        email: process.env.E2E_ADMIN_EMAIL,
        password: process.env.E2E_ADMIN_PASSWORD,
    }, "/admin/login");
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
}
