import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { digest, readBusinessRows } from "./order-integrity-migration.js";

export const ADMIN_MIGRATION = "20261104174440_admin_management";
export function snapshotBeforeAdmin(file) {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
        assert.ok(!db.prepare('PRAGMA table_info("Product")').all().some(column => column.name === "archivedAt"), "A pre-admin backup is required");
        return { rows: readBusinessRows(db), sequences: db.prepare("SELECT name,seq FROM sqlite_sequence").all() };
    } finally { db.close(); }
}
export function verifyAdminMigration(file, before) {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
        const after = readBusinessRows(db);
        for (const [table, rows] of Object.entries(before.rows)) {
            const keys = Object.keys(rows[0] || {});
            const originalFields = after[table].map(row => Object.fromEntries(keys.map(key => [key, row[key]])));
            assert.equal(digest(originalFields), digest(rows), table + " original fields changed");
        }
        assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
        assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
        for (const { name, seq } of before.sequences) assert.ok(db.prepare("SELECT seq FROM sqlite_sequence WHERE name=?").get(name).seq >= seq, name + " sequence regressed");
        for (const order of after.Order) {
            assert.equal(order.paymentStatus, ["Paid", "Shipped", "Delivered"].includes(order.status) ? "Unverified" : "Pending");
            assert.equal(order.fulfilmentStatus, ["Shipped", "Delivered", "Cancelled"].includes(order.status) ? order.status : "Unfulfilled");
            assert.equal(order.stockRestoredAt, null, "Do not invent a legacy restoration time");
        }
        assert.equal(db.prepare('SELECT COUNT(*) AS n FROM "PaymentRecord"').get().n, 0, "Do not fabricate payment evidence");
        assert.equal(db.prepare('SELECT COUNT(*) AS n FROM "OrderEvent"').get().n, before.rows.Order.length);
        for (const [table, field] of [["Product", "priceCents"], ["Product", "stock"], ["Order", "totalCents"], ["OrderItem", "quantity"], ["CartItem", "quantity"]]) {
            const sql = db.prepare("SELECT sql FROM sqlite_master WHERE name=?").get(table).sql;
            assert.ok(sql.includes(`typeof("${field}")`), table + " lost its Phase 5 CHECK constraint");
        }
        return { preserved: true, counts: Object.fromEntries(Object.entries(after).map(([table, rows]) => [table, rows.length])), integrity: "ok" };
    } finally { db.close(); }
}
