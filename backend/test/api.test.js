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
    });

    it("requires authentication and a non-empty cart to place an order", async () => {
        await request(app).post("/api/orders").send({ items: [] }).expect(401);
        await request(app).get("/api/orders/mine").expect(401);
        for (const items of [undefined, []]) {
            await request(app).post("/api/orders").auth(customerToken, { type: "bearer" }).send({ items }).expect(400);
        }
    });

    it("rolls back stock changes when a later cart item cannot be fulfilled", async (t) => {
        t.mock.method(console, "error", () => {});
        for (const unavailable of [{ productId: 0, quantity: 1 }, { productId: product.id, quantity: 10 }]) {
            await request(app).post("/api/orders").auth(customerToken, { type: "bearer" }).send({
                items: [{ productId: product.id, quantity: 1 }, unavailable],
            }).expect(400);
            assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 5);
            assert.equal(await prisma.order.count(), 0);
        }
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
});
