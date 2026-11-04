import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { readPdf } from "../test-support/read-pdf.js";
import { createTestDatabase } from "../test-support/database.js";

const seller = { name: "Eben Test Seller", address: "1 Test Street\nCape Town", email: "seller@example.test", registrationNumber: "TEST-REG", taxNumber: null };

describe("Private invoices", { concurrency: false }, () => {
    const originalDirectory = process.cwd(), originalEnvironment = { DATABASE_URL: process.env.DATABASE_URL, JWT_SECRET: process.env.JWT_SECRET, NODE_ENV: process.env.NODE_ENV };
    let database, app, prisma, uploads, hash, admin, customer, other, product, token, customerToken, otherToken;
    before(async () => {
        database = await createTestDatabase();
        process.env.DATABASE_URL = database.url; process.env.JWT_SECRET = randomBytes(32).toString("hex"); process.env.NODE_ENV = "test";
        process.chdir(database.directory);
        ({ default: app } = await import("../src/app.js")); ({ prisma } = await import("../src/lib/prisma.js"));
        ({ uploadsDirPath: uploads } = await import("../src/middleware/upload.js"));
        hash = await bcrypt.hash(randomBytes(24).toString("hex"), 4);
    });
    beforeEach(async () => {
        // Unique fixtures are retained until database teardown: issued records cannot be deleted.
        const user = (name, role = "CUSTOMER") => prisma.user.create({ data: { name, role, email: randomUUID() + "@invoice.test", password: hash } });
        admin = await user("Invoice Admin", "ADMIN"); customer = await user("Zoë Mokoena"); other = await user("Other Customer");
        product = await prisma.product.create({ data: { name: randomUUID(), priceCents: 29, stock: 100 } });
        const sign = value => jwt.sign({ sub: value.id }, process.env.JWT_SECRET, { expiresIn: "5m" });
        token = sign(admin); customerToken = sign(customer); otherToken = sign(other);
    });
    after(async () => {
        try { await prisma?.$disconnect(); }
        finally {
            process.chdir(originalDirectory);
            for (const [key, value] of Object.entries(originalEnvironment)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
            await database?.cleanup();
        }
    });
    const call = (method, url, body, auth = token) => request(app)[method](url).auth(auth, { type: "bearer" }).send(body);
    async function order(items = [{ productId: product.id, productName: "Original Tee", productDescription: "Saved details", quantity: 3, unitPriceCents: 29, lineTotalCents: 87 }], adjustmentCents = 0) {
        return prisma.order.create({ data: { userId: customer.id, customerName: customer.name, customerEmail: customer.email,
            shippingAddress: "2 Billing Road\nCape Town", totalCents: items.reduce((sum, item) => sum + item.lineTotalCents, adjustmentCents), adjustmentCents,
            items: { create: items } } });
    }
    const issue = row => call("post", `/api/orders/${row.id}/invoice`, { seller }).expect(201);

    it("requires admin issuance/list/config/correction/void and authenticated private reads", async t => {
        t.mock.method(console, "error", () => {});
        const row = await order();
        for (const [method, path] of [["post", `/api/orders/${row.id}/invoice`], ["get", "/api/invoices"], ["get", "/api/invoices/config"], ["post", "/api/invoices/1/void"], ["post", "/api/invoices/1/corrections"]]) {
            await request(app)[method](path).expect(401); await call(method, path, {}, customerToken).expect(403);
        }
        for (const path of ["/api/invoices/mine", "/api/invoices/1", "/api/invoices/1/pdf"]) await request(app).get(path).expect(401);
        assert.equal(await prisma.invoice.count({ where: { orderId: row.id } }), 0);
    });

    it("issues one uniquely numbered snapshot under concurrent and later retries without marking the order paid", async () => {
        const row = await order(), stock = product.stock;
        const results = await Promise.all(Array.from({ length: 4 }, () => call("post", `/api/orders/${row.id}/invoice`, { seller })));
        assert.deepEqual(results.map(result => result.status).sort(), [200, 200, 200, 201]);
        assert.equal(new Set(results.map(result => result.body.id)).size, 1);
        const invoice = results[0].body;
        assert.match(invoice.number, /^INV-\d{4}-\d{6,}$/);
        assert.equal(invoice.totalCents, 87); assert.equal(invoice.status, "Issued"); assert.equal(invoice.billing.name, customer.name);
        const retry = await call("post", `/api/orders/${row.id}/invoice`, { seller: { name: "Ignored edit" } }).expect(200);
        assert.deepEqual(retry.body, invoice); assert.equal(retry.headers["invoice-replayed"], "true");
        assert.equal(await prisma.invoice.count({ where: { orderId: row.id } }), 1);
        assert.equal(await prisma.invoiceEvent.count({ where: { invoiceId: invoice.id, type: "Issued" } }), 1);
        assert.equal(await prisma.adminAudit.count({ where: { entityType: "Invoice", entityId: invoice.id, action: "Invoice issued" } }), 1);
        const saved = await prisma.order.findUnique({ where: { id: row.id } });
        assert.equal(saved.paymentStatus, "Pending"); assert.equal(saved.status, "Pending"); assert.equal(saved.fulfilmentStatus, "Unfulfilled");
        assert.equal(await prisma.paymentRecord.count({ where: { orderId: row.id } }), 0);
        assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, stock);
    });

    it("stores validated seller/billing data and rejects injected amounts or incomplete billing before issuance", async t => {
        t.mock.method(console, "error", () => {});
        const row = await order();
        for (const body of [{ seller: { ...seller, address: " " } }, { seller: { ...seller, email: "invalid" } }, { seller, totalCents: 1 }, { seller, billing: { address: " " } }, { seller, billing: [] }]) {
            await call("post", `/api/orders/${row.id}/invoice`, body).expect(400);
        }
        assert.equal(await prisma.invoice.count({ where: { orderId: row.id } }), 0);
        const result = await call("post", `/api/orders/${row.id}/invoice`, { seller, billing: { name: "  Billing Company  ", address: "Billing HQ", registrationNumber: "BILL-REG" }, notes: "Customer reference ABC" }).expect(201);
        assert.equal(result.body.billing.name, "Billing Company"); assert.equal(result.body.billing.address, "Billing HQ");
        assert.equal(result.body.billing.email, customer.email); assert.equal(result.body.notes, "Customer reference ABC");
    });

    it("returns private PDF cents matching the order, including historical adjustments and accented text", async () => {
        const row = await order(undefined, -1), invoice = (await issue(row)).body;
        const beforeFiles = await readdir(uploads).catch(() => []);
        const response = await call("get", `/api/invoices/${invoice.id}/pdf`, undefined, customerToken).set("Origin", "http://localhost:4173").buffer(true).expect(200);
        assert.match(response.headers["content-type"], /application\/pdf/); assert.match(response.headers["cache-control"], /private, no-store/);
        assert.equal(response.headers["x-content-type-options"], "nosniff"); assert.ok(response.headers["content-disposition"].includes(invoice.number + ".pdf"));
        assert.ok(response.headers["access-control-expose-headers"].includes("Content-Disposition"));
        const pages = await readPdf(response.body), content = pages.map(page => page.text).join(" ");
        assert.equal(pages.length, 1); assert.ok(content.includes("Zoë Mokoena")); assert.ok(content.includes("Original Tee"));
        assert.ok(content.includes("R 0.29")); assert.ok(content.includes("R 0.87")); assert.ok(content.includes("-R 0.01"));
        assert.match(content, /Invoice total\s+R 0\.86/); assert.ok(!content.includes("0.869999"));
        assert.deepEqual(await readdir(uploads).catch(() => []), beforeFiles);
        await request(app).get(`/uploads/${invoice.number}.pdf`).expect(404);
    });

    it("does not expose another customer's invoice through ID, PDF, order filter or customerId parameters", async t => {
        t.mock.method(console, "error", () => {});
        const invoice = (await issue(await order())).body;
        for (const path of [`/api/invoices/${invoice.id}`, `/api/invoices/${invoice.id}/pdf`]) await call("get", path, undefined, otherToken).expect(404);
        const mine = await call("get", `/api/invoices/mine?customerId=${customer.id}&orderId=${invoice.orderId}`, undefined, otherToken).expect(200);
        assert.equal(mine.body.total, 0);
        const own = await call("get", `/api/invoices/${invoice.id}`, undefined, customerToken).expect(200);
        assert.equal(own.body.issuedBy, undefined); assert.equal(own.body.history[0].actorEmail, undefined);
        await call("get", `/api/invoices/${invoice.id}`, undefined, token).expect(200);
        const expired = jwt.sign({ sub: customer.id }, process.env.JWT_SECRET, { expiresIn: -1 });
        await call("get", `/api/invoices/${invoice.id}/pdf`, undefined, expired).expect(401);
    });

    it("keeps issued snapshots and PDF text unchanged after product, customer and seller configuration edits", async () => {
        const row = await order(), invoice = (await issue(row)).body;
        const first = await call("get", `/api/invoices/${invoice.id}/pdf`).buffer(true).expect(200);
        await prisma.product.update({ where: { id: product.id }, data: { name: "New catalogue name", priceCents: 9999, description: "Changed" } });
        await prisma.user.update({ where: { id: customer.id }, data: { name: "Changed customer", email: randomUUID() + "@changed.test" } });
        const savedName = process.env.INVOICE_SELLER_NAME;
        process.env.INVOICE_SELLER_NAME = "Changed seller setting";
        try {
            const detail = await call("get", `/api/invoices/${invoice.id}`).expect(200);
            assert.deepEqual(detail.body, invoice);
            const next = await call("get", `/api/invoices/${invoice.id}/pdf`).buffer(true).expect(200);
            assert.equal((await readPdf(next.body)).map(page => page.text).join(" "), (await readPdf(first.body)).map(page => page.text).join(" "));
        } finally { if (savedName === undefined) delete process.env.INVOICE_SELLER_NAME; else process.env.INVOICE_SELLER_NAME = savedName; }
    });

    it("renders long orders across readable numbered pages with complete rows and exact totals", async () => {
        const lines = Array.from({ length: 140 }, (_, index) => ({ productId: product.id, productName: `PAGE-LINE-${String(index + 1).padStart(3, "0")}`,
            productDescription: index === 0 ? "Long descriptive text ".repeat(150) + "X".repeat(600) : "Stored description",
            quantity: 3, unitPriceCents: index + 1, lineTotalCents: (index + 1) * 3 }));
        const row = await order(lines), invoice = (await issue(row)).body;
        const pdf = await call("get", `/api/invoices/${invoice.id}/pdf`).buffer(true).expect(200);
        const pages = await readPdf(pdf.body), combined = pages.map(page => page.text).join(" ");
        assert.ok(pages.length >= 6);
        for (const line of lines) assert.ok(combined.includes(line.productName), line.productName + " missing");
        for (const [index, page] of pages.entries()) {
            assert.ok(page.text.includes(invoice.number)); assert.ok(page.text.includes(`Page ${index + 1} of ${pages.length}`));
            for (const item of page.items) {
                assert.ok(item.transform[4] >= 35 && item.transform[4] + item.width <= page.width - 30, "Text overflowed the page width");
                assert.ok(item.transform[5] >= 15 && item.transform[5] <= page.height - 25, "Text overflowed the page height");
            }
        }
        assert.match(combined, /Invoice total\s+R 296\.10/);
    });

    it("prints maximum supported quantities and amounts without wrapping or rounding the numbers", async () => {
        const row = await order([{ productId: product.id, productName: "Maximum supported amount", quantity: 2147483647, unitPriceCents: 1, lineTotalCents: 2147483647 }]);
        const invoice = (await issue(row)).body;
        const pdf = await call("get", `/api/invoices/${invoice.id}/pdf`).buffer(true).expect(200);
        const pages = await readPdf(pdf.body), content = pages.map(page => page.text).join(" ");
        assert.equal(pages.length, 1); assert.ok(content.includes("2147483647"));
        assert.match(content, /Invoice total\s+R 21,474,836\.47/);
        for (const item of pages[0].items) assert.ok(item.transform[4] + item.width <= pages[0].width - 30);
    });

    it("creates a linked immutable correction once, retaining the original and all financial snapshots", async t => {
        t.mock.method(console, "error", () => {});
        const original = (await issue(await order())).body, body = { reason: "Correct billing address", billing: { address: "Corrected Billing HQ" } };
        const results = await Promise.all(Array.from({ length: 3 }, () => call("post", `/api/invoices/${original.id}/corrections`, body)));
        assert.deepEqual(results.map(row => row.status).sort(), [200, 200, 201]);
        assert.equal(new Set(results.map(row => row.body.id)).size, 1);
        const replacement = results[0].body;
        assert.notEqual(replacement.number, original.number); assert.equal(replacement.revision, 2); assert.equal(replacement.totalCents, original.totalCents);
        assert.equal(replacement.billing.address, "Corrected Billing HQ"); assert.equal(replacement.supersedes.id, original.id);
        const previous = await call("get", `/api/invoices/${original.id}`).expect(200);
        assert.equal(previous.body.status, "Voided"); assert.equal(previous.body.billing.address, original.billing.address);
        assert.equal(previous.body.supersededBy.id, replacement.id); assert.equal(previous.body.history.filter(row => row.type === "Corrected").length, 1);
        await call("post", `/api/invoices/${original.id}/corrections`, { ...body, billing: { address: "Conflicting retry" } }).expect(409);
        const issuedAgain = await call("post", `/api/orders/${original.orderId}/invoice`, {}).expect(200);
        assert.equal(issuedAgain.body.id, replacement.id);
        const pdf = await call("get", `/api/invoices/${original.id}/pdf`).buffer(true).expect(200);
        assert.ok((await readPdf(pdf.body))[0].text.includes("VOIDED INVOICE"));
    });

    it("voids repeat-safely with recorded reasons, blocks silent reissue and preserves payment state", async t => {
        t.mock.method(console, "error", () => {});
        const invoice = (await issue(await order())).body;
        await call("post", `/api/invoices/${invoice.id}/void`, {}).expect(400);
        const first = await call("post", `/api/invoices/${invoice.id}/void`, { reason: "Issued in error" }).expect(200);
        const retry = await call("post", `/api/invoices/${invoice.id}/void`, { reason: "Issued in error" }).expect(200);
        assert.deepEqual(first.body, retry.body);
        await call("post", `/api/invoices/${invoice.id}/void`, { reason: "Different reason" }).expect(409);
        const repeated = await call("post", `/api/orders/${invoice.orderId}/invoice`, {}).expect(200);
        assert.equal(repeated.body.status, "Voided"); assert.equal(repeated.body.id, invoice.id);
        assert.equal((await prisma.order.findUnique({ where: { id: invoice.orderId } })).paymentStatus, "Pending");
    });

    it("atomically voids the active invoice on cancellation and forbids replacement of cancelled orders", async t => {
        t.mock.method(console, "error", () => {});
        const invoice = (await issue(await order())).body;
        await call("post", `/api/admin/orders/${invoice.orderId}/cancel`, { reason: "Customer cancelled" }).expect(200);
        await call("post", `/api/admin/orders/${invoice.orderId}/cancel`, { reason: "Retry" }).expect(200);
        const detail = await call("get", `/api/invoices/${invoice.id}`).expect(200);
        assert.equal(detail.body.status, "Voided"); assert.equal(detail.body.history.filter(row => row.type === "Voided").length, 1);
        await call("post", `/api/invoices/${invoice.id}/corrections`, { reason: "Invalid replacement" }).expect(409);
        const cancelled = await order();
        await call("post", `/api/admin/orders/${cancelled.id}/cancel`, { reason: "No invoice needed" }).expect(200);
        await call("post", `/api/orders/${cancelled.id}/invoice`, { seller }).expect(409);
    });

    it("enforces snapshot immutability and sealing in the database", async () => {
        const invoice = (await issue(await order())).body;
        await assert.rejects(prisma.invoice.update({ where: { id: invoice.id }, data: { sellerName: "Tampered" } }));
        await assert.rejects(prisma.invoiceLine.update({ where: { id: invoice.lines[0].id }, data: { productName: "Tampered" } }));
        await assert.rejects(prisma.invoiceLine.create({ data: { invoiceId: invoice.id, position: 2, sourceOrderItemId: 1, productName: "Injected", quantity: 1, unitPriceCents: 0, lineTotalCents: 0 } }));
        await assert.rejects(prisma.invoiceEvent.delete({ where: { id: invoice.history[0].id } }));
        await assert.rejects(prisma.invoice.delete({ where: { id: invoice.id } }));
        assert.equal((await call("get", `/api/invoices/${invoice.id}`).expect(200)).body.seller.name, seller.name);
    });

    it("lists and filters admin invoices while customer lists remain scoped to the verified account", async t => {
        t.mock.method(console, "error", () => {});
        const first = (await issue(await order())).body, second = (await issue(await order())).body;
        const filtered = await call("get", `/api/invoices?q=${first.number}`).expect(200);
        assert.equal(filtered.body.total, 1); assert.equal(filtered.body.items[0].id, first.id);
        const own = await call("get", "/api/invoices/mine?pageSize=1", undefined, customerToken).expect(200);
        assert.equal(own.body.total, 2); assert.equal(own.body.totalPages, 2); assert.equal(own.body.items[0].id, second.id);
        await call("get", "/api/invoices?pageSize=101").expect(400);
        await call("get", "/api/invoices?status=Draft").expect(400);
    });
});
