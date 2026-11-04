import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { placeOrder } from "../src/lib/checkout.js";
import { after, before, beforeEach, describe, it } from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import sharp from "sharp";
import { readdir } from "node:fs/promises";
import { createTestDatabase } from "../test-support/database.js";

describe("Eben Studios API", { concurrency: false }, () => {
    const originalDirectory = process.cwd();
    const originalEnvironment = {
        DATABASE_URL: process.env.DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET,
        NODE_ENV: process.env.NODE_ENV,
    };
    const password = randomBytes(24).toString("hex");
    let database, app, prisma, uploadsDirPath, hashedPassword, admin, customer, product;
    let adminToken, customerToken;

    before(async () => {
        database = await createTestDatabase();
        process.env.DATABASE_URL = database.url;
        process.env.JWT_SECRET = randomBytes(32).toString("hex");
        process.env.NODE_ENV = "test";
        // Uploads, as well as the database, stay inside this disposable directory.
        process.chdir(database.directory);
        ({ default: app } = await import("../src/app.js"));
        ({ uploadsDirPath } = await import("../src/middleware/upload.js"));
        ({ prisma } = await import("../src/lib/prisma.js"));
        hashedPassword = await bcrypt.hash(password, 4);
    });

    beforeEach(async () => {
        await prisma.$transaction([
            prisma.paymentRecord.deleteMany(),
            prisma.orderEvent.deleteMany(),
            prisma.stockAdjustment.deleteMany(),
            prisma.adminAudit.deleteMany(),
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
        product = await prisma.product.create({ data: { name: "Test Hoodie", priceCents: 10000, stock: 5 } });
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
        const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
        const created = await request(app).post("/api/products").auth(adminToken, { type: "bearer" })
            .field("name", "Admin Tee").field("price", "75").field("stock", "8")
            .attach("image", image, { filename: "tee.png", contentType: "image/png" }).expect(201);
        assert.equal(created.body.price, 75);
        const uploaded = await request(app).get(new URL(created.body.imageUrl).pathname).expect(200);
        assert.equal((await sharp(uploaded.body).metadata()).format, "png");
        const updated = await request(app).put(`/api/products/${created.body.id}`)
            .auth(adminToken, { type: "bearer" }).send({ price: 90, stock: 10, stockReason: "Inventory recount" }).expect(200);
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
        const response = await request(app).post("/api/orders").set("Idempotency-Key", randomUUID()).auth(customerToken, { type: "bearer" }).send({
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
        await request(app).post("/api/orders").set("Idempotency-Key", randomUUID()).send({ items: [] }).expect(401);
        await request(app).get("/api/orders/mine").expect(401);
        for (const items of [undefined, [], [{ productId: product.id, quantity: 1 }]]) {
            await request(app).post("/api/orders").set("Idempotency-Key", randomUUID()).auth(customerToken, { type: "bearer" }).send({ items }).expect(400);
        }
    });

    it("rolls back stock changes when a later cart item cannot be fulfilled", async (t) => {
        t.mock.method(console, "error", () => {});
        const second = await prisma.product.create({ data: { name: "Second Tee", priceCents: 5000, stock: 1 } });
        for (const productId of [product.id, second.id]) {
            await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" })
                .send({ productId, quantity: 1 }).expect(200);
        }
        await prisma.product.update({ where: { id: second.id }, data: { stock: 0 } });
        await request(app).post("/api/orders").set("Idempotency-Key", randomUUID()).auth(customerToken, { type: "bearer" }).send({}).expect(409);
        assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 5);
        assert.equal(await prisma.order.count(), 0);
        assert.equal(await prisma.cartItem.count(), 2);
    });

    it("keeps other customers' orders out of the customer's order history", async () => {
        await prisma.order.create({ data: { userId: admin.id, totalCents: 2500, customerName: admin.name, customerEmail: admin.email } });
        const mine = await request(app).get("/api/orders/mine").auth(customerToken, { type: "bearer" }).expect(200);
        assert.deepEqual(mine.body, []);
        const all = await request(app).get("/api/orders").auth(adminToken, { type: "bearer" }).expect(200);
        assert.equal(all.body.length, 1);
        assert.equal(all.body[0].user.password, undefined);
    });

    it("lets admins update order status and rejects invalid or missing orders", async () => {
        const order = await prisma.order.create({ data: { userId: customer.id, totalCents: 10000, customerName: customer.name, customerEmail: customer.email } });
        await request(app).post(`/api/admin/orders/${order.id}/payments`).auth(adminToken, { type: "bearer" })
            .send({ reference: randomUUID(), amountCents: 10000 }).expect(200);
        const updated = await request(app).patch(`/api/orders/${order.id}/status`)
            .auth(adminToken, { type: "bearer" }).send({ status: "Processing" }).expect(200);
        assert.equal(updated.body.status, "Processing");
        assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).status, "Processing");
        await request(app).patch(`/api/orders/${order.id}/status`)
            .auth(adminToken, { type: "bearer" }).send({ status: "Unknown" }).expect(400);
        await request(app).patch("/api/orders/999999/status")
            .auth(adminToken, { type: "bearer" }).send({ status: "Processing" }).expect(404);
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
            assert.equal(response.body.items[0].price, product.priceCents / 100);
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
        await prisma.product.update({ where: { id: product.id }, data: { priceCents: 12500 } });
        const placed = await request(app).post("/api/orders").set("Idempotency-Key", randomUUID()).auth(customerToken, { type: "bearer" }).send({
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
        await request(app).post("/api/orders").set("Idempotency-Key", randomUUID()).auth(customerToken, { type: "bearer" })
            .send({ cartId: other.id, userId: admin.id }).expect(400);
        assert.equal(await prisma.order.count(), 0);
        assert.equal(await prisma.cartItem.count(), 1);
    });

    it("revalidates saved quantities and preserves the cart on failed checkout", async (t) => {
        t.mock.method(console, "error", () => {});
        await assert.rejects(prisma.cart.create({ data: {
            userId: customer.id, items: { create: { productId: product.id, quantity: -1 } },
        } }));
        await request(app).post("/api/orders").set("Idempotency-Key", randomUUID()).auth(customerToken, { type: "bearer" }).send({}).expect(400);
        assert.equal(await prisma.order.count(), 0);
        assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 5);
        assert.equal(await prisma.cartItem.count(), 0);
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
        await prisma.product.update({ where: { id: product.id }, data: { priceCents: 12500 } });
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
        const unavailable = await prisma.product.create({ data: { name: "Unavailable Tee", priceCents: 5000, stock: 0 } });
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

    it("calculates R0.29 times three as exactly 87 cents", async () => {
        await request(app).put("/api/products/" + product.id).auth(adminToken, { type: "bearer" }).send({ price: "0.29" }).expect(200);
        await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" })
            .send({ productId: product.id, quantity: 3 }).expect(200);
        const response = await request(app).post("/api/orders").auth(customerToken, { type: "bearer" })
            .set("Idempotency-Key", randomUUID()).send({ shippingAddress: "Exact Money Street" }).expect(201);
        assert.equal(response.body.totalCents, 87);
        assert.equal(response.body.total, 0.87);
        assert.equal(response.body.items[0].unitPriceCents, 29);
        assert.equal(response.body.items[0].lineTotalCents, 87);
        assert.equal(response.body.adjustmentCents, 0);
    });

    it("rejects invalid product amounts and stock before changing stored values", async (t) => {
        t.mock.method(console, "error", () => {});
        for (const price of ["-1", "0.001", "1e3", "NaN", "21474836.48"]) {
            await request(app).put("/api/products/" + product.id).auth(adminToken, { type: "bearer" }).send({ price }).expect(400);
        }
        for (const stock of [-1, 1.5]) {
            await request(app).put("/api/products/" + product.id).auth(adminToken, { type: "bearer" }).send({ stock }).expect(400);
        }
        const stored = await prisma.product.findUnique({ where: { id: product.id } });
        assert.equal(stored.priceCents, 10000);
        assert.equal(stored.stock, 5);
    });

    it("requires a valid checkout idempotency key before writing an order", async (t) => {
        t.mock.method(console, "error", () => {});
        await request(app).post("/api/orders").auth(customerToken, { type: "bearer" }).send({}).expect(400);
        await request(app).post("/api/orders").auth(customerToken, { type: "bearer" })
            .set("Idempotency-Key", "not-a-uuid").send({}).expect(400);
        assert.equal(await prisma.order.count(), 0);
    });

    it("does not oversell the last unit under simultaneous HTTP purchases", async (t) => {
        t.mock.method(console, "error", () => {});
        await prisma.product.update({ where: { id: product.id }, data: { stock: 1 } });
        for (const token of [customerToken, adminToken]) {
            await request(app).post("/api/cart/items").auth(token, { type: "bearer" }).send({ productId: product.id, quantity: 1 }).expect(200);
        }
        const results = await Promise.all([customerToken, adminToken].map(token => request(app).post("/api/orders")
            .auth(token, { type: "bearer" }).set("Idempotency-Key", randomUUID()).send({})));
        assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
        assert.equal(await prisma.order.count(), 1);
        assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 0);
        assert.equal(await prisma.cartItem.count(), 1);
    });

    it("cannot oversell across independent database clients", async () => {
        await prisma.product.update({ where: { id: product.id }, data: { stock: 1 } });
        for (const token of [customerToken, adminToken]) {
            await request(app).post("/api/cart/items").auth(token, { type: "bearer" }).send({ productId: product.id, quantity: 1 }).expect(200);
        }
        const clients = [new PrismaClient({ datasources: { db: { url: database.url } } }), new PrismaClient({ datasources: { db: { url: database.url } } })];
        try {
            const results = await Promise.allSettled([customer, admin].map((user, index) =>
                placeOrder(clients[index], { sub: user.id, name: user.name, email: user.email }, randomUUID(), null)));
            assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
            assert.equal(results.find(result => result.status === "rejected").reason.status, 409);
            assert.equal(await prisma.order.count(), 1);
            assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 0);
        } finally { await Promise.all(clients.map(client => client.$disconnect())); }
    });

    it("creates one order for concurrent and later retries with the same checkout key", async () => {
        await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" }).send({ productId: product.id, quantity: 2 }).expect(200);
        const key = randomUUID();
        const results = await Promise.all(Array.from({ length: 4 }, () => request(app).post("/api/orders")
            .auth(customerToken, { type: "bearer" }).set("Idempotency-Key", key).send({ shippingAddress: "Retry Street" })));
        assert.equal(results.filter(result => result.status === 201).length, 1);
        assert.equal(results.filter(result => result.status === 200).length, 3);
        assert.equal(new Set(results.map(result => result.body.id)).size, 1);
        const retry = await request(app).post("/api/orders").auth(customerToken, { type: "bearer" })
            .set("Idempotency-Key", key).send({ shippingAddress: "Retry Street" }).expect(200);
        assert.equal(retry.headers["idempotency-replayed"], "true");
        assert.equal(retry.body.id, results[0].body.id);
        assert.equal(await prisma.order.count(), 1);
        assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 3);
    });

    it("rejects changed retry details and does not consume a newly refilled cart on replay", async (t) => {
        t.mock.method(console, "error", () => {});
        const add = () => request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" })
            .send({ productId: product.id, quantity: 1 }).expect(200);
        await add();
        const key = randomUUID();
        const first = await request(app).post("/api/orders").auth(customerToken, { type: "bearer" })
            .set("Idempotency-Key", key).send({ shippingAddress: "Original Street" }).expect(201);
        await add();
        await request(app).post("/api/orders").auth(customerToken, { type: "bearer" })
            .set("Idempotency-Key", key).send({ shippingAddress: "Different Street" }).expect(409);
        const replay = await request(app).post("/api/orders").auth(customerToken, { type: "bearer" })
            .set("Idempotency-Key", key).send({ shippingAddress: "Original Street" }).expect(200);
        assert.equal(replay.body.id, first.body.id);
        assert.equal(await prisma.order.count(), 1);
        assert.equal(await prisma.cartItem.count(), 1);
        assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 4);
        await request(app).post("/api/orders").auth(customerToken, { type: "bearer" })
            .set("Idempotency-Key", randomUUID()).send({ shippingAddress: "Original Street" }).expect(201);
        assert.equal(await prisma.order.count(), 2);
    });

    it("keeps historical customer and product details after edits and archiving, and prevents destructive deletion", async (t) => {
        t.mock.method(console, "error", () => {});
        await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" })
            .send({ productId: product.id, quantity: 1 }).expect(200);
        const placed = await request(app).post("/api/orders").auth(customerToken, { type: "bearer" })
            .set("Idempotency-Key", randomUUID()).send({}).expect(201);
        await prisma.product.update({ where: { id: product.id }, data: {
            name: "Renamed Product", priceCents: 29, description: "New description", imageUrl: "https://example.test/new.png",
        } });
        await prisma.user.update({ where: { id: customer.id }, data: { name: "Changed Customer", email: "changed@eben.test" } });
        const edited = await request(app).get("/api/orders/mine").auth(customerToken, { type: "bearer" }).expect(200);
        assert.deepEqual(edited.body[0], placed.body);
        await request(app).delete("/api/products/" + product.id).auth(adminToken, { type: "bearer" }).expect(409);
        await request(app).patch(`/api/admin/products/${product.id}/archive`).auth(adminToken, { type: "bearer" })
            .send({ archived: true, reason: "Discontinued" }).expect(200);
        const deleted = await request(app).get("/api/orders/mine").auth(customerToken, { type: "bearer" }).expect(200);
        assert.equal(deleted.body[0].items[0].productId, product.id);
        assert.equal(deleted.body[0].items[0].productName, "Test Hoodie");
        assert.equal(deleted.body[0].items[0].unitPriceCents, 10000);
        assert.equal(deleted.body[0].customerName, "Test Customer");
        assert.equal(deleted.body[0].totalCents, 10000);
    });

    const call = (method, url, body) => request(app)[method](url).auth(adminToken, { type: "bearer" }).send(body);
    async function place(quantity = 1) {
        await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" }).send({ productId: product.id, quantity }).expect(200);
        return (await request(app).post("/api/orders").auth(customerToken, { type: "bearer" }).set("Idempotency-Key", randomUUID()).send({ shippingAddress: "Admin Test Road" }).expect(201)).body;
    }

    it("rejects guests and customers on every admin management endpoint", async () => {
        for (const [method, url] of [
            ["get", "/api/admin/products"], ["get", "/api/admin/orders"], ["get", "/api/admin/orders/1"],
            ["get", "/api/admin/dashboard"], ["get", "/api/admin/audit"], ["get", `/api/admin/products/${product.id}/history`],
            ["patch", `/api/admin/products/${product.id}/archive`], ["post", `/api/admin/products/${product.id}/stock-adjustments`],
            ["patch", "/api/admin/orders/1/fulfilment"], ["post", "/api/admin/orders/1/cancel"],
            ["post", "/api/admin/orders/1/payments"], ["post", "/api/admin/orders/1/refunds"], ["patch", "/api/admin/orders/1/shipping"],
        ]) {
            await request(app)[method](url).expect(401);
            await request(app)[method](url).auth(customerToken, { type: "bearer" }).expect(403);
        }
        assert.equal(await prisma.adminAudit.count(), 0);
        assert.equal(await prisma.stockAdjustment.count(), 0);
    });

    it("validates product text, money, thresholds and stock without persisting failed changes", async t => {
        t.mock.method(console, "error", () => {});
        for (const data of [{ name: " " }, { name: 12 }, { name: "x".repeat(121) }, { description: [] }, { tag: "x".repeat(81) }, { lowStockThreshold: -1 }, { lowStockThreshold: 1.5 }, { stock: null }]) {
            await call("put", `/api/products/${product.id}`, data).expect(400);
        }
        await call("post", "/api/products", { name: "No price" }).expect(400);
        const created = await call("post", "/api/products", { name: "  Valid Tee  ", price: "0.29", stock: 2, lowStockThreshold: 3, actorId: customer.id }).expect(201);
        assert.equal(created.body.name, "Valid Tee");
        assert.equal(created.body.lowStock, true);
        const audit = await prisma.adminAudit.findFirst();
        assert.equal(audit.actorId, admin.id);
        assert.equal(audit.actorName, admin.name);
        assert.equal(JSON.parse(audit.afterJson).priceCents, 29);
        assert.equal(await prisma.adminAudit.count(), 1);
        const stock = await prisma.stockAdjustment.findFirst();
        assert.equal(stock.reason, "Initial stock on creation");
        assert.equal(stock.delta, 2);
    });

    it("searches and filters products with stable server pagination and validated bounds", async t => {
        t.mock.method(console, "error", () => {});
        await prisma.product.createMany({ data: Array.from({ length: 12 }, (_, index) => ({
            name: `Filter Tee ${index}`, description: "Searchable range", tag: index < 8 ? "Drop" : "Other", priceCents: 100,
            stock: index, lowStockThreshold: 3, archivedAt: index === 11 ? new Date() : null,
        })) });
        const first = await call("get", "/api/admin/products?q=Filter%20Tee&pageSize=5").expect(200);
        const second = await call("get", "/api/admin/products?q=Filter%20Tee&pageSize=5&page=2").expect(200);
        assert.equal(first.body.total, 11); assert.equal(first.body.totalPages, 3);
        assert.equal(new Set([...first.body.items, ...second.body.items].map(row => row.id)).size, 10);
        const low = await call("get", "/api/admin/products?q=Searchable&stock=low&tag=Drop").expect(200);
        assert.equal(low.body.total, 4); assert.ok(low.body.items.every(row => row.lowStock));
        const archived = await call("get", "/api/admin/products?status=archived").expect(200);
        assert.equal(archived.body.total, 1);
        for (const query of ["page=0", "pageSize=101", "status=unknown", "stock=unknown", "page=1.2"]) await call("get", "/api/admin/products?" + query).expect(400);
    });

    it("archives and restores products while blocking every purchase path and retaining history", async t => {
        t.mock.method(console, "error", () => {});
        await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" }).send({ productId: product.id, quantity: 1 }).expect(200);
        const archived = await call("patch", `/api/admin/products/${product.id}/archive`, { archived: true, reason: "Season ended" }).expect(200);
        assert.ok(archived.body.archivedAt);
        assert.equal((await request(app).get("/api/products").expect(200)).body.length, 0);
        await request(app).get(`/api/products/${product.id}`).expect(404);
        // Guest-like merging must remain safe even if a liked product was archived.
        await request(app).put(`/api/likes/${product.id}`).auth(customerToken, { type: "bearer" }).expect(200);
        assert.equal((await request(app).get("/api/likes").auth(customerToken, { type: "bearer" }).expect(200)).body.length, 0);
        await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" }).send({ productId: product.id, quantity: 1 }).expect(409);
        await request(app).patch(`/api/cart/items/${product.id}`).auth(customerToken, { type: "bearer" }).send({ quantity: 2 }).expect(409);
        await request(app).post("/api/orders").auth(customerToken, { type: "bearer" }).set("Idempotency-Key", randomUUID()).send({}).expect(409);
        assert.equal(await prisma.order.count(), 0);
        assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 5);
        await call("patch", `/api/admin/products/${product.id}/archive`, { archived: false, reason: "New season" }).expect(200);
        await request(app).get(`/api/products/${product.id}`).expect(200);
        assert.equal((await request(app).get("/api/likes").auth(customerToken, { type: "bearer" }).expect(200)).body[0].id, product.id);
        const order = await request(app).post("/api/orders").auth(customerToken, { type: "bearer" }).set("Idempotency-Key", randomUUID()).send({}).expect(201);
        assert.equal(order.body.items[0].productName, product.name);
        const audit = await call("get", `/api/admin/audit?entityType=Product&entityId=${product.id}`).expect(200);
        assert.equal(audit.body.total, 2); assert.equal(audit.body.items[0].actorEmail, admin.email);
    });

    it("records reasoned stock adjustments atomically, rejects invalid deltas and serializes concurrent adjustments", async t => {
        t.mock.method(console, "error", () => {});
        for (const body of [{ delta: 1 }, { delta: 1, reason: " " }, { delta: 0, reason: "Invalid" }, { delta: 1.5, reason: "Invalid" }, { delta: -6, reason: "Invalid" }, { delta: "2", reason: "Invalid" }]) {
            await call("post", `/api/admin/products/${product.id}/stock-adjustments`, body).expect(body.delta === -6 ? 409 : 400);
        }
        assert.equal(await prisma.stockAdjustment.count(), 0); assert.equal(await prisma.adminAudit.count(), 0);
        await Promise.all([2, -1].map(delta => call("post", `/api/admin/products/${product.id}/stock-adjustments`, { delta, reason: "Warehouse count", actorId: customer.id }).expect(200)));
        assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 6);
        const history = await call("get", `/api/admin/products/${product.id}/history`).expect(200);
        assert.equal(history.body.adjustments.total, 2);
        for (const row of history.body.adjustments.items) {
            assert.equal(row.actorId, admin.id); assert.equal(row.actorName, admin.name); assert.ok(row.createdAt);
            assert.equal(row.afterStock, row.beforeStock + row.delta); assert.equal(row.reason, "Warehouse count");
        }
    });

    it("requires a stock reason on the legacy product edit path too", async t => {
        t.mock.method(console, "error", () => {});
        await call("put", `/api/products/${product.id}`, { stock: 9 }).expect(400);
        await call("put", `/api/products/${product.id}`, { stock: 9, stockReason: "Physical recount" }).expect(200);
        const row = await prisma.stockAdjustment.findFirst();
        assert.equal(row.delta, 4); assert.equal(row.reason, "Physical recount"); assert.equal(row.actorId, admin.id);
    });

    it("decodes image content and cleans files after failed saves without removing the current image", async t => {
        t.mock.method(console, "error", () => {});
        const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
        const files = async () => (await readdir(uploadsDirPath).catch(() => [])).sort();
        const before = await files();
        for (const buffer of [Buffer.from("not an image"), image.subarray(0, 40), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')]) {
            await request(app).put(`/api/products/${product.id}`).auth(adminToken, { type: "bearer" }).attach("image", buffer, { filename: "fake.png", contentType: "image/png" }).expect(400);
        }
        await request(app).put(`/api/products/${product.id}`).auth(adminToken, { type: "bearer" }).attach("image", image, { filename: "fake.jpg", contentType: "image/jpeg" }).expect(400);
        await request(app).put(`/api/products/${product.id}`).auth(adminToken, { type: "bearer" }).attach("image", Buffer.alloc(5 * 1024 * 1024 + 1), { filename: "big.png", contentType: "image/png" }).expect(400);
        await request(app).post("/api/products").auth(adminToken, { type: "bearer" }).field("name", product.name).field("price", "10").attach("image", image, { filename: "valid.png", contentType: "image/png" }).expect(409);
        assert.deepEqual(await files(), before);
        const saved = await request(app).put(`/api/products/${product.id}`).auth(adminToken, { type: "bearer" }).attach("image", image, { filename: "valid.png", contentType: "image/png" }).expect(200);
        const currentFiles = await files();
        await request(app).put(`/api/products/${product.id}`).auth(adminToken, { type: "bearer" }).field("stock", "9").attach("image", image, { filename: "other.png", contentType: "image/png" }).expect(400);
        assert.deepEqual(await files(), currentFiles);
        await request(app).get(new URL(saved.body.imageUrl).pathname).expect(200);
    });

    it("cleans replaced unused images and preserves an image referenced by historical order details", async () => {
        const image = color => sharp({ create: { width: 2, height: 2, channels: 3, background: color } }).png().toBuffer();
        const save = async color => request(app).put(`/api/products/${product.id}`).auth(adminToken, { type: "bearer" }).attach("image", await image(color), { filename: "image.png", contentType: "image/png" }).expect(200);
        const first = await save("red"); const second = await save("blue");
        await request(app).get(new URL(first.body.imageUrl).pathname).expect(404);
        const order = await place();
        assert.equal(order.items[0].productImageUrl, second.body.imageUrl);
        await save("green");
        await request(app).get(new URL(second.body.imageUrl).pathname).expect(200);
    });

    it("searches and filters order pages and returns customer, address, items and actor history", async () => {
        const first = await place(); const second = await place();
        await call("post", `/api/admin/orders/${first.id}/payments`, { reference: randomUUID(), amountCents: first.totalCents }).expect(200);
        const list = await call("get", "/api/admin/orders?pageSize=1").expect(200);
        assert.equal(list.body.total, 2); assert.equal(list.body.totalPages, 2); assert.equal(list.body.items[0].id, second.id);
        const filter = await call("get", "/api/admin/orders?paymentStatus=Confirmed&fulfilmentStatus=Unfulfilled").expect(200);
        assert.deepEqual(filter.body.items.map(row => row.id), [first.id]);
        const search = await call("get", `/api/admin/orders?q=%23EB-${second.id}`).expect(200);
        assert.equal(search.body.total, 1);
        const details = await call("get", `/api/admin/orders/${first.id}`).expect(200);
        assert.equal(details.body.customerEmail, customer.email); assert.equal(details.body.shippingAddress, "Admin Test Road");
        assert.equal(details.body.items[0].productName, product.name); assert.equal(details.body.history[0].type, "Created");
        assert.equal(details.body.payments[0].actorId, admin.id); assert.equal(details.body.history[1].actorId, admin.id);
    });

    it("enforces fulfilment transitions and shipping requirements on both admin and legacy routes", async t => {
        t.mock.method(console, "error", () => {});
        const order = await place();
        await call("patch", `/api/admin/orders/${order.id}/fulfilment`, { fulfilmentStatus: "Delivered" }).expect(409);
        await call("patch", `/api/orders/${order.id}/status`, { status: "Shipped", shippingReference: "FORGED" }).expect(409);
        await call("patch", `/api/orders/${order.id}/status`, { status: "Paid" }).expect(400);
        assert.equal(await prisma.adminAudit.count(), 0); assert.equal(await prisma.paymentRecord.count(), 0);
        assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).status, "Pending");
        await call("post", `/api/admin/orders/${order.id}/payments`, { reference: randomUUID(), amountCents: order.totalCents }).expect(200);
        await call("patch", `/api/admin/orders/${order.id}/fulfilment`, { fulfilmentStatus: "Processing" }).expect(200);
        await call("patch", `/api/admin/orders/${order.id}/fulfilment`, { fulfilmentStatus: "Shipped" }).expect(400);
        await call("patch", `/api/admin/orders/${order.id}/fulfilment`, { fulfilmentStatus: "Shipped", shippingReference: "SHIP-001" }).expect(200);
        await call("post", `/api/admin/orders/${order.id}/cancel`, { reason: "Too late" }).expect(409);
        await call("patch", `/api/admin/orders/${order.id}/shipping`, { shippingReference: "SHIP-002", reason: "Courier reference corrected" }).expect(200);
        const delivered = await call("patch", `/api/admin/orders/${order.id}/fulfilment`, { fulfilmentStatus: "Delivered" }).expect(200);
        assert.equal(delivered.body.shippingReference, "SHIP-002"); assert.equal(delivered.body.paymentStatus, "Confirmed");
        await call("patch", `/api/admin/orders/${order.id}/fulfilment`, { fulfilmentStatus: "Processing" }).expect(409);
        assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 4);
    });

    it("restores stock once for simultaneous and repeated cancellations, including archived products", async () => {
        const order = await place(2);
        await call("patch", `/api/admin/products/${product.id}/archive`, { archived: true, reason: "Discontinued" }).expect(200);
        const results = await Promise.all(Array.from({ length: 4 }, () => call("post", `/api/admin/orders/${order.id}/cancel`, { reason: "Customer requested cancellation" }).expect(200)));
        assert.equal(new Set(results.map(row => row.body.stockRestoredAt)).size, 1);
        await call("post", `/api/admin/orders/${order.id}/cancel`, { reason: "Retry" }).expect(200);
        assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 5);
        assert.equal(await prisma.stockAdjustment.count({ where: { orderId: order.id } }), 1);
        assert.equal(await prisma.orderEvent.count({ where: { orderId: order.id, type: "Order cancelled" } }), 1);
        assert.equal(results[0].body.paymentStatus, "Pending");
        const legacy = await prisma.order.create({ data: { userId: customer.id, customerName: customer.name,
            customerEmail: customer.email, totalCents: 0, status: "Cancelled", fulfilmentStatus: "Cancelled", stockRestoredAt: null } });
        await call("post", `/api/admin/orders/${legacy.id}/cancel`, { reason: "Legacy retry" }).expect(200);
        assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 5);
        assert.equal(await prisma.stockAdjustment.count(), 1);
    });

    it("rolls back an entire cancellation if a later stock restoration is unsafe", async t => {
        t.mock.method(console, "error", () => {});
        const other = await prisma.product.create({ data: { name: "Second cancellation item", priceCents: 1, stock: 1 } });
        await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" }).send({ productId: product.id, quantity: 1 }).expect(200);
        await request(app).post("/api/cart/items").auth(customerToken, { type: "bearer" }).send({ productId: other.id, quantity: 1 }).expect(200);
        const order = (await request(app).post("/api/orders").auth(customerToken, { type: "bearer" }).set("Idempotency-Key", randomUUID()).send({}).expect(201)).body;
        await prisma.product.update({ where: { id: other.id }, data: { stock: 2147483647 } });
        await call("post", `/api/admin/orders/${order.id}/cancel`, { reason: "Unsafe restore" }).expect(409);
        assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 4);
        assert.equal(await prisma.stockAdjustment.count(), 0); assert.equal(await prisma.adminAudit.count(), 0);
        assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).fulfilmentStatus, "Unfulfilled");
    });

    it("validates payment evidence and prevents duplicate confirmations or reuse of a payment reference", async t => {
        t.mock.method(console, "error", () => {});
        const first = await place(), second = await place(), reference = randomUUID();
        await call("post", `/api/admin/orders/${first.id}/payments`, { reference, amountCents: 1 }).expect(400);
        await call("post", `/api/admin/orders/${first.id}/payments`, { amountCents: first.totalCents }).expect(400);
        await Promise.all(Array.from({ length: 3 }, () => call("post", `/api/admin/orders/${first.id}/payments`, { reference, amountCents: first.totalCents }).expect(200)));
        assert.equal(await prisma.paymentRecord.count(), 1);
        assert.equal(await prisma.orderEvent.count({ where: { type: "Payment confirmed" } }), 1);
        await call("post", `/api/admin/orders/${second.id}/payments`, { reference, amountCents: second.totalCents }).expect(409);
        assert.equal((await prisma.order.findUnique({ where: { id: second.id } })).paymentStatus, "Pending");
        await call("post", `/api/admin/orders/${second.id}/cancel`, { reason: "Cancelled before paying" }).expect(200);
        await call("post", `/api/admin/orders/${second.id}/payments`, { reference: randomUUID(), amountCents: second.totalCents }).expect(409);
    });

    it("counts verified active payments separately from pending, cancelled and refunded orders", async () => {
        const confirmed = await place(2); await place();
        const report = async () => (await call("get", "/api/admin/dashboard").expect(200)).body;
        assert.equal((await report()).confirmedPaymentsCents, "0");
        await call("post", `/api/admin/orders/${confirmed.id}/payments`, { reference: randomUUID(), amountCents: confirmed.totalCents }).expect(200);
        assert.equal((await report()).confirmedPaymentsCents, "20000");
        const cancelled = await call("post", `/api/admin/orders/${confirmed.id}/cancel`, { reason: "Customer changed their mind" }).expect(200);
        assert.equal(cancelled.body.paymentStatus, "RefundRequired");
        let data = await report(); assert.equal(data.confirmedPaymentsCents, "0"); assert.equal(data.awaitingRefundCents, "20000");
        const reference = randomUUID();
        await call("post", `/api/admin/orders/${confirmed.id}/refunds`, { reference, amountCents: confirmed.totalCents }).expect(200);
        await call("post", `/api/admin/orders/${confirmed.id}/refunds`, { reference, amountCents: confirmed.totalCents }).expect(200);
        data = await report(); assert.equal(data.confirmedPaymentsCents, "0"); assert.equal(data.awaitingRefundCents, "0"); assert.equal(data.refundedCents, "20000");
        assert.equal(data.pendingOrders, 1); assert.equal(await prisma.paymentRecord.count({ where: { kind: "Refund" } }), 1);
    });
});
