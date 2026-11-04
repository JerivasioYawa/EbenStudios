import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export const ORDER_INTEGRITY_MIGRATION = "20261104170707_order_integrity";
const tables = ["User", "Product", "Order", "OrderItem", "Cart", "CartItem", "ProductLike"];

function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    return value;
}
export function digest(value) {
    return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
export function readBusinessRows(db) {
    return Object.fromEntries(tables.map(table => [table, db.prepare('SELECT * FROM "' + table + '" ORDER BY id').all()]));
}

export function legacySnapshot(file) {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
        assert.ok(db.prepare('PRAGMA table_info("Product")').all().some(column => column.name === "price"), "A pre-integrity backup is required");
        const original = readBusinessRows(db);
        const cents = (table, field, id) => db.prepare('SELECT CAST(ROUND("' + field + '"*100) AS INTEGER) AS cents FROM "' + table + '" WHERE id=?').get(id).cents;
        const expected = { ...original };
        expected.Product = original.Product.map(({ price, ...row }) => ({ ...row, priceCents: cents("Product", "price", row.id) }));
        expected.OrderItem = original.OrderItem.map(({ price, ...row }) => {
            const product = original.Product.find(product => product.id === row.productId);
            const unitPriceCents = cents("OrderItem", "price", row.id);
            return { ...row, productName: product?.name, productDescription: product?.description,
                productImageUrl: product?.imageUrl, unitPriceCents, lineTotalCents: unitPriceCents * row.quantity };
        });
        expected.Order = original.Order.map(({ total, ...row }) => {
            const user = original.User.find(user => user.id === row.userId);
            const totalCents = cents("Order", "total", row.id);
            const lines = expected.OrderItem.filter(item => item.orderId === row.id).reduce((sum, item) => sum + item.lineTotalCents, 0);
            return { ...row, totalCents, currency: "ZAR", adjustmentCents: totalCents - lines,
                customerName: user?.name, customerEmail: user?.email, idempotencyKey: "legacy-order-" + row.id };
        });
        return { original, expected, sequences: db.prepare("SELECT name,seq FROM sqlite_sequence").all() };
    } finally { db.close(); }
}

export function verifyMigratedDatabase(file, before) {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
        const after = readBusinessRows(db);
        for (const table of tables) {
            assert.equal(after[table].length, before.original[table].length, table + " row count must be preserved");
            // Compare hashes so a failed check never prints personal data or password hashes.
            assert.equal(digest(after[table]), digest(before.expected[table]), table + " conversion/snapshots/relationships differ");
        }
        assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
        assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0, "Foreign keys must remain valid");
        for (const { name, seq } of before.sequences) {
            if (!["Product", "Order", "OrderItem", "CartItem"].includes(name)) continue;
            assert.ok(db.prepare("SELECT seq FROM sqlite_sequence WHERE name=?").get(name).seq >= seq, name + " sequence regressed");
        }
        return { preserved: true, counts: Object.fromEntries(tables.map(table => [table, after[table].length])), integrity: "ok" };
    } finally { db.close(); }
}
