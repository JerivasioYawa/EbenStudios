import { test, expect, apiURL, newCustomer, registerCustomer, login, productImage } from "./support/fixtures.js";

const guestKey = "eben_guest_likes_v1";

async function logout(page) {
    await page.goto("/profile");
    await page.getByRole("button", { name: "Log Out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
}

test("guest hearts work with mouse and keyboard, survive refresh, and never trigger product navigation", async ({ page, request }) => {
    const before = await request.get(`${apiURL}/products`);
    const stockBefore = (await before.json()).map(product => [product.id, product.stock]);
    const guestApi = await request.get(`${apiURL}/likes`);
    expect(guestApi.status()).toBe(401);
    const likesRequests = [];
    page.on("request", outgoing => { if (outgoing.url().startsWith(`${apiURL}/likes`)) likesRequests.push(outgoing); });
    await page.goto("/shop");
    const heart = page.getByRole("button", { name: "Like Woodstock Hoodie", exact: true });
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(await heart.evaluate(element => element.closest("a") === null)).toBe(true);
    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/\/shop$/);
    await heart.press("Enter");
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await heart.press("Space");
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("heading", { name: "Woodstock Hoodie", exact: true }).click();
    await expect(page).toHaveURL(/\/products\/\d+$/);
    const productURL = page.url();
    const detailsHeart = page.getByRole("button", { name: "Like Woodstock Hoodie", exact: true });
    await expect(detailsHeart).toHaveAttribute("aria-pressed", "true");
    await detailsHeart.focus();
    await detailsHeart.press("Enter");
    await expect(detailsHeart).toHaveAttribute("aria-pressed", "false");
    await detailsHeart.press("Space");
    await expect(detailsHeart).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(productURL);
    await page.getByRole("link", { name: "Liked products", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Liked Products", level: 1, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Woodstock Hoodie", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Like Woodstock Hoodie", exact: true }).press("Space");
    await expect(page.getByText(/no liked products yet/i)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/no liked products yet/i)).toBeVisible();
    expect(likesRequests).toHaveLength(0);
    const after = await request.get(`${apiURL}/products`);
    expect((await after.json()).map(product => [product.id, product.stock])).toEqual(stockBefore);
});

test("login merges guest likes once, keeps existing account likes, and leaves cart and stock unchanged", async ({ page, request }) => {
    const customer = newCustomer();
    const registration = await request.post(`${apiURL}/auth/register`, { data: customer });
    expect(registration.status()).toBe(201);
    const { token } = await registration.json();
    const headers = { Authorization: `Bearer ${token}` };
    const catalogue = await request.get(`${apiURL}/products`);
    const products = await catalogue.json();
    const cap = products.find(product => product.name === "Movement Cap");
    const hoodie = products.find(product => product.name === "Woodstock Hoodie");
    expect((await request.put(`${apiURL}/likes/${cap.id}`, { headers })).status()).toBe(200);
    expect((await request.post(`${apiURL}/cart/items`, { headers, data: { productId: cap.id, quantity: 2 } })).status()).toBe(200);
    const originalCart = await (await request.get(`${apiURL}/cart`, { headers })).json();
    const stockBefore = products.map(product => [product.id, product.stock]);

    await page.goto("/shop");
    await page.getByRole("button", { name: "Like Movement Cap", exact: true }).click();
    await page.getByRole("button", { name: "Like Woodstock Hoodie", exact: true }).click();
    const merged = [];
    page.on("request", outgoing => {
        if (outgoing.url().startsWith(`${apiURL}/likes/`) && outgoing.method() === "PUT") merged.push(outgoing.url());
    });
    await login(page, customer);
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("link", { name: "Liked products", exact: true }).click();
    await expect(page.getByRole("button", { name: "Like Movement Cap", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Like Woodstock Hoodie", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(merged.sort()).toEqual([`${apiURL}/likes/${cap.id}`, `${apiURL}/likes/${hoodie.id}`].sort());
    expect(await page.evaluate(key => localStorage.getItem(key), guestKey)).toBeNull();
    await page.reload();
    await expect(page.getByRole("button", { name: "Like Woodstock Hoodie", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(merged).toHaveLength(2);
    const savedLikes = await (await request.get(`${apiURL}/likes`, { headers })).json();
    expect(savedLikes.map(product => product.id).sort((a, b) => a - b)).toEqual([cap.id, hoodie.id].sort((a, b) => a - b));
    await page.getByRole("button", { name: "Like Woodstock Hoodie", exact: true }).click();
    await expect(page.getByRole("button", { name: "Like Woodstock Hoodie", exact: true })).toHaveCount(0);
    await logout(page);
    await login(page, customer);
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/liked");
    await expect(page.getByRole("button", { name: "Like Movement Cap", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Like Woodstock Hoodie", exact: true })).toHaveCount(0);
    expect(merged).toHaveLength(2);
    expect(await (await request.get(`${apiURL}/cart`, { headers })).json()).toEqual(originalCart);
    const after = await request.get(`${apiURL}/products`);
    expect((await after.json()).map(product => [product.id, product.stock])).toEqual(stockBefore);
});

test("account likes persist in a separate browser context and account likes never become guest likes", async ({ page, browser, baseURL }) => {
    const customer = await registerCustomer(page);
    await page.goto("/shop");
    await page.getByRole("button", { name: "Like Streets Tee", exact: true }).click();
    await expect(page.getByRole("button", { name: "Like Streets Tee", exact: true })).toHaveAttribute("aria-pressed", "true");
    const other = await browser.newContext({ baseURL });
    try {
        const otherPage = await other.newPage();
        await otherPage.route("https://picsum.photos/**", route => route.fulfill({ contentType: "image/png", body: productImage }));
        await login(otherPage, customer);
        await expect(otherPage).toHaveURL(/\/$/);
        await otherPage.goto("/liked");
        const secondHeart = otherPage.getByRole("button", { name: "Like Streets Tee", exact: true });
        await expect(secondHeart).toHaveAttribute("aria-pressed", "true");
        expect(await otherPage.evaluate(key => localStorage.getItem(key), guestKey)).toBeNull();
        await secondHeart.click();
        await expect(otherPage.getByText(/no liked products yet/i)).toBeVisible();
        await page.goto("/liked");
        await expect(page.getByText(/no liked products yet/i)).toBeVisible();
    } finally { await other.close(); }
    await page.goto("/shop");
    await page.getByRole("button", { name: "Like Streets Tee", exact: true }).click();
    await expect(page.getByRole("button", { name: "Like Streets Tee", exact: true })).toHaveAttribute("aria-pressed", "true");
    await logout(page);
    await page.goto("/liked");
    await expect(page.getByText(/no liked products yet/i)).toBeVisible();
});
