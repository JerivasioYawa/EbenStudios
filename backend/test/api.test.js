import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createTestDatabase } from "../test-support/database.js";

describe("Eben Studios API", { concurrency: false }, () => {
    const originalDirectory = process.cwd();
    const originalEnvironment = {
        DATABASE_URL: process.env.DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET,
        NODE_ENV: process.env.NODE_ENV,
    };
    const password = randomBytes(24).toString("hex");
    let database, app, prisma, hashedPassword, admin, customer, product;
    let adminToken, customerToken;

    before(async () => {
        database = await createTestDatabase();
        process.env.DATABASE_URL = database.url;
        process.env.JWT_SECRET = randomBytes(32).toString("hex");
        process.env.NODE_ENV = "test";
        // Uploads, as well as the database, stay inside this disposable directory.
        process.chdir(database.directory);
        ({ default: app } = await import("../src/app.js"));
        ({ prisma } = await import("../src/lib/prisma.js"));
        hashedPassword = await bcrypt.hash(password, 4);
    });

    beforeEach(async () => {
        await prisma.$transaction([
            prisma.productLike.deleteMany(),
            prisma.cartItem.deleteMany(),
            prisma.cart.deleteMany(),
            prisma.orderItem.deleteMany(),
            prisma.order.deleteMany(),
            prisma.product.deleteMany(),
            prisma.user.deleteMany(),
        ]);
        admin = await prisma.user.create({ data: {
            name: "Test Admin", email: "admin@eben.test", password: hashedPassword, role: "ADMIN",
        } });
        customer = await prisma.user.create({ data: {
            name: "Test Customer", email: "customer@eben.test", password: hashedPassword,
        } });
        product = await prisma.product.create({ data: { name: "Test Hoodie", price: 100, stock: 5 } });
        const token = (user) => jwt.sign(
            { sub: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "5m" },
        );
        adminToken = token(admin);
        customerToken = token(customer);
    });

    after(async () => {
        try {
            await prisma?.$disconnect();
        } finally {
            process.chdir(originalDirectory);
            for (const [key, value] of Object.entries(originalEnvironment)) {
                if (value === undefined) delete process.env[key];
                else process.env[key] = value;
            }
            await database?.cleanup();
        }
    });

    it("responds to health checks and unknown routes", async () => {
        const health = await request(app).get("/api/health").expect(200);
        assert.deepEqual(health.body, { status: "ok" });
        const missing = await request(app).get("/api/missing").expect(404);
        assert.equal(missing.body.message, "Not found");
    });

    it("registers a customer, hashes their password, and ignores requested admin privileges", async () => {
        const response = await request(app).post("/api/auth/register").send({
            name: "New Customer", email: "new@eben.test", password, role: "ADMIN",
        }).expect(201);
        assert.equal(response.body.user.role, "CUSTOMER");
        assert.equal(response.body.user.password, undefined);
        assert.ok(response.body.token);
        const stored = await prisma.user.findUnique({ where: { email: "new@eben.test" } });
        assert.notEqual(stored.password, password);
        assert.ok(await bcrypt.compare(password, stored.password));
    });

    it("rejects incomplete registration and duplicate email addresses", async () => {
        await request(app).post("/api/auth/register").send({ email: "new@eben.test" }).expect(400);
        await request(app).post("/api/auth/register").send({
            name: customer.name, email: customer.email, password,
        }).expect(409);
    });

    it("logs in and retrieves the public user without exposing the password", async () => {
        const login = await request(app).post("/api/auth/login").send({ email: customer.email, password }).expect(200);
        assert.equal(login.body.user.password, undefined);
        const profile = await request(app).get("/api/auth/me")
            .auth(login.body.token, { type: "bearer" }).expect(200);
        assert.deepEqual(profile.body.user, login.body.user);
    });

    it("rejects incorrect passwords and unknown accounts", async () => {
        for (const credentials of [
            { email: customer.email, password: "incorrect" },
            { email: "missing@eben.test", password },
        ]) {
            const response = await request(app).post("/api/auth/login").send(credentials).expect(401);
            assert.equal(response.body.message, "Invalid email or password");
        }
    });

    it("rejects missing, invalid, and expired authentication", async () => {
        await request(app).get("/api/auth/me").expect(401);
        await request(app).get("/api/auth/me").auth("invalid", { type: "bearer" }).expect(401);
        const expired = jwt.sign({ sub: customer.id }, process.env.JWT_SECRET, { expiresIn: -1 });
        await request(app).get("/api/auth/me").auth(expired, { type: "bearer" }).expect(401);
    });

    it("serves the public catalogue and returns 404 for missing products", async () => {
        const list = await request(app).get("/api/products").expect(200);
        assert.deepEqual(list.body.map((item) => item.id), [product.id]);
        const detail = await request(app).get(`/api/products/${product.id}`).expect(200);
        assert.equal(detail.body.name, product.name);
        await request(app).get("/api/products/0").expect(404);
    });

    it("restricts product mutations and order administration to admins", async () => {
        for (const [method, url] of [
            ["post", "/api/products"],
            ["put", `/api/products/${product.id}`],
            ["delete", `/api/products/${product.id}`],
            ["get", "/api/orders"],
            ["patch", "/api/orders/0/status"],
        ]) {
            await request(app)[method](url).expect(401);
            await request(app)[method](url).auth(customerToken, { type: "bearer" }).expect(403);
        }
        assert.equal(await prisma.product.count(), 1);
    });

    it("lets admins create, upload an image, update, and delete a product", async () => {
        const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=", "base64");
        const created = await request(app).post("/api/products").auth(adminToken, { type: "bearer" })
            .field("name", "Admin Tee").field("price", "75").field("stock", "8")
            .attach("image", image, { filename: "tee.png", contentType: "image/png" }).expect(201);
        assert.equal(created.body.price, 75);
        const uploaded = await request(app).get(new URL(created.body.imageUrl).pathname).expect(200);
        assert.deepEqual(uploaded.body, image);
        const updated = await request(app).put(`/api/products/${created.body.id}`)
            .auth(adminToken, { type: "bearer" }).send({ price: 90, stock: 10 }).expect(200);
        assert.equal(updated.body.price, 90);
        assert.equal(updated.body.stock, 10);
        assert.equal(updated.body.imageUrl, created.body.imageUrl);
        await request(app).delete(`/api/products/${created.body.id}`)
            .auth(adminToken, { type: "bearer" }).expect(204);
        await request(app).get(`/api/products/${created.body.id}`).expect(404);
    });

    it("creates orders using database prices and decrements inventory", async () => {
        await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" })
            .send({ productId: product.id, quantity: 2 }).expect(200);
        const response = await request(app).post("/api/orders").auth(customerToken, { type: "bearer" }).send({
            items: [{ productId: product.id, quantity: 2, price: 1 }],
            total: 1, shippingAddress: "1 Test Street, Cape Town, 8001",
        }).expect(201);
        assert.equal(response.body.total, 200);
        assert.equal(response.body.userId, customer.id);
        assert.equal(response.body.status, "Pending");
        assert.equal(response.body.items[0].price, 100);
        assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 3);
        const mine = await request(app).get("/api/orders/mine").auth(customerToken, { type: "bearer" }).expect(200);
        assert.deepEqual(mine.body.map((order) => order.id), [response.body.id]);
        assert.equal(await prisma.cartItem.count(), 0);
    });

    it("requires authentication and a saved non-empty cart to place an order", async (t) => {
        t.mock.method(console, "error", () => {});
        await request(app).post("/api/orders").send({ items: [] }).expect(401);
        await request(app).get("/api/orders/mine").expect(401);
        for (const items of [undefined, [], [{ productId: product.id, quantity: 1 }]]) {
            await request(app).post("/api/orders").auth(customerToken, { type: "bearer" }).send({ items }).expect(400);
        }
    });

    it("rolls back stock changes when a later cart item cannot be fulfilled", async (t) => {
        t.mock.method(console, "error", () => {});
        const second = await prisma.product.create({ data: { name: "Second Tee", price: 50, stock: 1 } });
        for (const productId of [product.id, second.id]) {
            await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" })
                .send({ productId, quantity: 1 }).expect(200);
        }
        await prisma.product.update({ where: { id: second.id }, data: { stock: 0 } });
        await request(app).post("/api/orders").auth(customerToken, { type: "bearer" }).send({}).expect(400);
        assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 5);
        assert.equal(await prisma.order.count(), 0);
        assert.equal(await prisma.cartItem.count(), 2);
    });

    it("keeps other customers' orders out of the customer's order history", async () => {
        await prisma.order.create({ data: { userId: admin.id, total: 25 } });
        const mine = await request(app).get("/api/orders/mine").auth(customerToken, { type: "bearer" }).expect(200);
        assert.deepEqual(mine.body, []);
        const all = await request(app).get("/api/orders").auth(adminToken, { type: "bearer" }).expect(200);
        assert.equal(all.body.length, 1);
        assert.equal(all.body[0].user.password, undefined);
    });

    it("lets admins update order status and rejects invalid or missing orders", async () => {
        const order = await prisma.order.create({ data: { userId: customer.id, total: 100 } });
        const updated = await request(app).patch(`/api/orders/${order.id}/status`)
            .auth(adminToken, { type: "bearer" }).send({ status: "Shipped" }).expect(200);
        assert.equal(updated.body.status, "Shipped");
        assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).status, "Shipped");
        await request(app).patch(`/api/orders/${order.id}/status`)
            .auth(adminToken, { type: "bearer" }).send({ status: "Unknown" }).expect(400);
        await request(app).patch("/api/orders/0/status")
            .auth(adminToken, { type: "bearer" }).send({ status: "Paid" }).expect(404);
    });

    it("rejects every guest cart API action and saves nothing", async () => {
        for (const [method, url] of [
            ["get", "/api/cart"], ["post", "/api/cart/items"],
            ["patch", `/api/cart/items/${product.id}`], ["delete", `/api/cart/items/${product.id}`],
            ["delete", "/api/cart"],
        ]) {
            await request(app)[method](url).send({ productId: product.id, quantity: 1 }).expect(401);
        }
        assert.equal(await prisma.cart.count(), 0);
        assert.equal(await prisma.cartItem.count(), 0);
    });

    it("returns an empty authenticated cart without creating records on read", async () => {
        const response = await request(app).get("/api/cart").auth(customerToken, { type: "bearer" }).expect(200);
        assert.deepEqual(response.body, { items: [] });
        assert.equal(await prisma.cart.count(), 0);
    });

    it("persists cart items for the session user and does not reserve stock", async () => {
        for (let addition = 1; addition <= 2; addition++) {
            const response = await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" })
                .send({ productId: product.id, quantity: 1, userId: admin.id, price: 1 }).expect(200);
            assert.equal(response.body.items[0].id, product.id);
            assert.equal(response.body.items[0].quantity, addition);
            assert.equal(response.body.items[0].price, product.price);
        }
        const saved = await prisma.cart.findUnique({ where: { userId: customer.id }, include: { items: true } });
        assert.equal(saved.items[0].quantity, 2);
        assert.equal(await prisma.cart.count({ where: { userId: admin.id } }), 0);
        assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 5);
        const restored = await request(app).get("/api/cart").auth(customerToken, { type: "bearer" }).expect(200);
        assert.equal(restored.body.items[0].quantity, 2);
    });

    it("rejects non-positive, fractional, string, missing, and excessive quantities", async (t) => {
        t.mock.method(console, "error", () => {});
        for (const quantity of [0, -1, 1.5, "2", null, undefined, 2_147_483_648]) {
            await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" })
                .send({ productId: product.id, quantity }).expect(400);
        }
        assert.equal(await prisma.cartItem.count(), 0);
        await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" })
            .send({ productId: product.id, quantity: 1 }).expect(200);
        for (const quantity of [0, -1, 1.5, "2", null, undefined, 2_147_483_648]) {
            await request(app).patch(`/api/cart/items/${product.id}`).auth(customerToken, { type: "bearer" })
                .send({ quantity }).expect(400);
        }
        assert.equal((await prisma.cartItem.findFirst()).quantity, 1);
    });

    it("rejects unavailable products and aggregate quantities above current stock", async (t) => {
        t.mock.method(console, "error", () => {});
        await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" })
            .send({ productId: 999999, quantity: 1 }).expect(404);
        await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" })
            .send({ productId: product.id, quantity: 6 }).expect(400);
        await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" })
            .send({ productId: product.id, quantity: 4 }).expect(200);
        await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" })
            .send({ productId: product.id, quantity: 2 }).expect(400);
        await request(app).patch(`/api/cart/items/${product.id}`).auth(customerToken, { type: "bearer" })
            .send({ quantity: 6 }).expect(400);
        assert.equal((await prisma.cartItem.findFirst()).quantity, 4);
        assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 5);
    });

    it("does not let supplied user IDs or cart IDs cross account boundaries", async () => {
        for (const token of [customerToken, adminToken]) {
            await request(app).post("/api/cart/items").auth(token, { type: "bearer" })
                .send({ productId: product.id, quantity: 1 }).expect(200);
        }
        const other = await prisma.cart.findUnique({ where: { userId: admin.id } });
        const response = await request(app).patch(`/api/cart/items/${product.id}`)
            .auth(customerToken, { type: "bearer" }).send({ quantity: 3, cartId: other.id, userId: admin.id }).expect(200);
        assert.equal(response.body.items[0].quantity, 3);
        const otherItem = () => prisma.cartItem.findFirst({ where: { cartId: other.id } });
        assert.equal((await otherItem()).quantity, 1);
        const read = await request(app).get(`/api/cart?cartId=${other.id}&userId=${admin.id}`)
            .auth(customerToken, { type: "bearer" }).expect(200);
        assert.equal(read.body.items[0].quantity, 3);
        await request(app).delete(`/api/cart/items/${product.id}`).auth(customerToken, { type: "bearer" }).expect(200);
        await request(app).delete(`/api/cart?cartId=${other.id}`).auth(customerToken, { type: "bearer" }).expect(200);
        assert.equal((await otherItem()).quantity, 1);
    });

    it("updates and removes only the authenticated user's cart items", async () => {
        await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" })
            .send({ productId: product.id, quantity: 1 }).expect(200);
        const updated = await request(app).patch(`/api/cart/items/${product.id}`).auth(customerToken, { type: "bearer" })
            .send({ quantity: 3 }).expect(200);
        assert.equal(updated.body.items[0].quantity, 3);
        const cleared = await request(app).delete("/api/cart").auth(customerToken, { type: "bearer" }).expect(200);
        assert.deepEqual(cleared.body.items, []);
        assert.equal(await prisma.cartItem.count(), 0);
    });

    it("rejects expired and deleted sessions before saving cart data", async () => {
        const expired = jwt.sign({ sub: customer.id }, process.env.JWT_SECRET, { expiresIn: -1 });
        await request(app).post("/api/cart/items").auth(expired, { type: "bearer" })
            .send({ productId: product.id, quantity: 1 }).expect(401);
        await prisma.user.delete({ where: { id: customer.id } });
        await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" })
            .send({ productId: product.id, quantity: 1 }).expect(401);
        assert.equal(await prisma.cart.count(), 0);
    });

    it("revalidates current prices and ignores a forged checkout item list", async () => {
        await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" })
            .send({ productId: product.id, quantity: 2 }).expect(200);
        await prisma.product.update({ where: { id: product.id }, data: { price: 125 } });
        const placed = await request(app).post("/api/orders").auth(customerToken, { type: "bearer" }).send({
            items: [{ productId: 0, quantity: -10, price: 1 }], total: 1, userId: admin.id,
        }).expect(201);
        assert.equal(placed.body.total, 250);
        assert.equal(placed.body.items[0].quantity, 2);
        assert.equal(placed.body.items[0].price, 125);
        assert.equal(placed.body.userId, customer.id);
        assert.equal(await prisma.cartItem.count(), 0);
    });

    it("cannot checkout another user's cart by supplying its ID", async (t) => {
        t.mock.method(console, "error", () => {});
        await request(app).post("/api/cart/items").auth(adminToken, { type: "bearer" })
            .send({ productId: product.id, quantity: 1 }).expect(200);
        const other = await prisma.cart.findUnique({ where: { userId: admin.id } });
        await request(app).post("/api/orders").auth(customerToken, { type: "bearer" })
            .send({ cartId: other.id, userId: admin.id }).expect(400);
        assert.equal(await prisma.order.count(), 0);
        assert.equal(await prisma.cartItem.count(), 1);
    });

    it("revalidates saved quantities and preserves the cart on failed checkout", async (t) => {
        t.mock.method(console, "error", () => {});
        await prisma.cart.create({ data: {
            userId: customer.id, items: { create: { productId: product.id, quantity: -1 } },
        } });
        await request(app).post("/api/orders").auth(customerToken, { type: "bearer" }).send({}).expect(400);
        assert.equal(await prisma.order.count(), 0);
        assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 5);
        assert.equal(await prisma.cartItem.count(), 1);
    });

    it("requires authentication for every likes endpoint and rejects expired sessions", async () => {
        await request(app).get("/api/likes").expect(401);
        await request(app).put(`/api/likes/${product.id}`).expect(401);
        await request(app).delete(`/api/likes/${product.id}`).expect(401);
        const expired = jwt.sign({ sub: customer.id }, process.env.JWT_SECRET, { expiresIn: -1 });
        await request(app).put(`/api/likes/${product.id}`).auth(expired, { type: "bearer" }).expect(401);
        assert.equal(await prisma.productLike.count(), 0);
    });

    it("lists an empty account without writes and returns current liked product details", async () => {
        const empty = await request(app).get("/api/likes").auth(customerToken, { type: "bearer" }).expect(200);
        assert.deepEqual(empty.body, []);
        await request(app).put(`/api/likes/${product.id}`).auth(customerToken, { type: "bearer" }).expect(200);
        await prisma.product.update({ where: { id: product.id }, data: { price: 125 } });
        const response = await request(app).get("/api/likes").auth(customerToken, { type: "bearer" }).expect(200);
        assert.equal(response.body.length, 1);
        assert.equal(response.body[0].id, product.id);
        assert.equal(response.body[0].price, 125);
        assert.equal(response.body[0].userId, undefined);
    });

    it("makes repeated like and unlike requests idempotent", async () => {
        for (let repeat = 0; repeat < 3; repeat++) {
            const response = await request(app).put(`/api/likes/${product.id}`)
                .auth(customerToken, { type: "bearer" }).send({ userId: admin.id, price: 1 }).expect(200);
            assert.equal(response.body.id, product.id);
        }
        assert.equal(await prisma.productLike.count(), 1);
        assert.equal((await prisma.productLike.findFirst()).userId, customer.id);
        for (let repeat = 0; repeat < 3; repeat++) {
            await request(app).delete(`/api/likes/${product.id}`).auth(customerToken, { type: "bearer" }).expect(204);
        }
        assert.equal(await prisma.productLike.count(), 0);
    });

    it("does not create duplicates under concurrent like requests", async () => {
        const responses = await Promise.all(Array.from({ length: 8 }, () =>
            request(app).put(`/api/likes/${product.id}`).auth(customerToken, { type: "bearer" })));
        assert.deepEqual(responses.map(response => response.status), Array(8).fill(200));
        assert.equal(await prisma.productLike.count({ where: { userId: customer.id, productId: product.id } }), 1);
    });

    it("scopes likes to the verified account despite supplied foreign account IDs", async () => {
        for (const token of [customerToken, adminToken]) {
            await request(app).put(`/api/likes/${product.id}`).auth(token, { type: "bearer" }).expect(200);
        }
        assert.equal(await prisma.productLike.count(), 2);
        await request(app).delete(`/api/likes/${product.id}?userId=${admin.id}`)
            .auth(customerToken, { type: "bearer" }).expect(204);
        const own = await request(app).get(`/api/likes?userId=${admin.id}`).auth(customerToken, { type: "bearer" }).expect(200);
        assert.deepEqual(own.body, []);
        const other = await request(app).get("/api/likes").auth(adminToken, { type: "bearer" }).expect(200);
        assert.deepEqual(other.body.map(item => item.id), [product.id]);
        assert.equal(await prisma.productLike.count(), 1);
    });

    it("validates like product IDs and handles missing products without creating rows", async () => {
        for (const id of ["0", "-1", "1.5", "abc", "2147483648"]) {
            await request(app).put(`/api/likes/${id}`).auth(customerToken, { type: "bearer" }).expect(400);
            await request(app).delete(`/api/likes/${id}`).auth(customerToken, { type: "bearer" }).expect(400);
        }
        await request(app).put("/api/likes/999999").auth(customerToken, { type: "bearer" }).expect(404);
        await request(app).delete("/api/likes/999999").auth(customerToken, { type: "bearer" }).expect(204);
        assert.equal(await prisma.productLike.count(), 0);
    });

    it("does not change cart contents, orders, or stock when liking or unliking", async () => {
        await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" })
            .send({ productId: product.id, quantity: 2 }).expect(200);
        const unavailable = await prisma.product.create({ data: { name: "Unavailable Tee", price: 50, stock: 0 } });
        const snapshot = async () => ({
            products: await prisma.product.findMany({ orderBy: { id: "asc" } }),
            carts: await prisma.cart.findMany({ orderBy: { id: "asc" } }),
            items: await prisma.cartItem.findMany({ orderBy: { id: "asc" } }),
            orders: await prisma.order.findMany(),
        });
        const before = await snapshot();
        for (const productId of [product.id, unavailable.id]) {
            await request(app).put(`/api/likes/${productId}`).auth(customerToken, { type: "bearer" }).expect(200);
            await request(app).delete(`/api/likes/${productId}`).auth(customerToken, { type: "bearer" }).expect(204);
        }
        assert.deepEqual(await snapshot(), before);
    });

    it("removes dependent likes when their user or product is deleted", async () => {
        for (const token of [customerToken, adminToken]) {
            await request(app).put(`/api/likes/${product.id}`).auth(token, { type: "bearer" }).expect(200);
        }
        await prisma.user.delete({ where: { id: customer.id } });
        assert.equal(await prisma.productLike.count(), 1);
        await prisma.product.delete({ where: { id: product.id } });
        assert.equal(await prisma.productLike.count(), 0);
    });
});
