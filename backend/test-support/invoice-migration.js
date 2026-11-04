import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { digest } from "./order-integrity-migration.js";

export const INVOICE_MIGRATION = "20261104184859_invoices";
const tables = ["User", "Product", "Order", "OrderItem", "Cart", "CartItem", "ProductLike", "AdminAudit", "StockAdjustment", "OrderEvent", "PaymentRecord"];
export function snapshotBeforeInvoices(file) {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
        assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='Invoice'").get().n, 0, "A pre-invoice backup is required");
        return { rows: Object.fromEntries(tables.map(table => [table, db.prepare('SELECT * FROM "' + table + '" ORDER BY id').all()])),
            schema: db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'_prisma_migrations' ORDER BY name").all(),
            sequences: db.prepare("SELECT name,seq FROM sqlite_sequence").all() };
    } finally { db.close(); }
}
export function verifyInvoiceMigration(file, before) {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
        for (const table of tables) assert.equal(digest(db.prepare('SELECT * FROM "' + table + '" ORDER BY id').all()), digest(before.rows[table]), table + " changed");
        for (const { name, sql } of before.schema) assert.equal(db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name).sql, sql, name + " schema/guards changed");
        for (const { name, seq } of before.sequences) assert.ok(db.prepare("SELECT seq FROM sqlite_sequence WHERE name=?").get(name).seq >= seq);
        for (const table of ["Invoice", "InvoiceLine", "InvoiceEvent", "InvoiceSequence"]) assert.equal(db.prepare('SELECT COUNT(*) AS n FROM "' + table + '"').get().n, 0);
        assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
        assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
        return { preserved: true, counts: Object.fromEntries(tables.map(table => [table, before.rows[table].length])), integrity: "ok" };
    } finally { db.close(); }
}
