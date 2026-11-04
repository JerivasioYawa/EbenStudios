import assert from "node:assert/strict";
import { it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createTestDatabase, deployMigrations } from "../test-support/database.js";
import { ORDER_INTEGRITY_MIGRATION, digest, legacySnapshot, readBusinessRows, verifyMigratedDatabase } from "../test-support/order-integrity-migration.js";

function historicalFixtures(file) {
    const db = new DatabaseSync(file);
    try {
        db.exec(`
            INSERT INTO "User" (id,name,email,password,role) VALUES (501,'Legacy Customer','migration@example.test','test-only-hash','CUSTOMER');
            INSERT INTO "Product" (id,name,description,price,stock,imageUrl) VALUES
                (701,'Legacy Product','Saved description',1.99,7,'https://example.test/old.png'),
                (702,'Rounding Product',NULL,12.345,5,NULL),
                (703,'Half Cent Product',NULL,0.005,0,NULL);
            INSERT INTO "Order" (id,userId,total,status,shippingAddress,createdAt) VALUES
                (901,501,0.8699999999999999,'Paid','1 Legacy Street',1700000000000),
                (902,501,25,'Pending',NULL,1700000000001),
                (903,501,2.47,'Delivered','2 Legacy Street',1700000000002);
            INSERT INTO "OrderItem" (id,orderId,productId,quantity,price) VALUES
                (1001,901,701,3,0.29),(1002,903,702,2,1.235);
            INSERT INTO "Cart" (id,userId) VALUES (1201,501);
            INSERT INTO "CartItem" (id,cartId,productId,quantity) VALUES (1301,1201,701,2);
            INSERT INTO "ProductLike" (id,userId,productId) VALUES (1401,501,701);
            UPDATE sqlite_sequence SET seq=9000 WHERE name='Order';
            UPDATE sqlite_sequence SET seq=8000 WHERE name='Product';
            UPDATE sqlite_sequence SET seq=10000 WHERE name='OrderItem';
            UPDATE sqlite_sequence SET seq=14000 WHERE name='CartItem';
        `);
    } finally { db.close(); }
}

it("converts historical amounts, backfills snapshots, and preserves every row, relationship, and sequence", async () => {
    const database = await createTestDatabase({ beforeMigration: ORDER_INTEGRITY_MIGRATION });
    try {
        historicalFixtures(database.file);
        const before = legacySnapshot(database.file);
        deployMigrations(database.url);
        assert.equal(verifyMigratedDatabase(database.file, before).preserved, true);
        const db = new DatabaseSync(database.file);
        try {
            assert.equal(db.prepare('SELECT priceCents FROM "Product" WHERE id=702').get().priceCents, 1235);
            assert.equal(db.prepare('SELECT priceCents FROM "Product" WHERE id=703').get().priceCents, 1);
            const item = db.prepare('SELECT * FROM "OrderItem" WHERE id=1001').get();
            assert.equal(item.unitPriceCents, 29);
            assert.equal(item.lineTotalCents, 87);
            assert.equal(db.prepare('SELECT totalCents FROM "Order" WHERE id=901').get().totalCents, 87);
            assert.equal(db.prepare('SELECT adjustmentCents FROM "Order" WHERE id=902').get().adjustmentCents, 2500);
            assert.equal(db.prepare('SELECT adjustmentCents FROM "Order" WHERE id=903').get().adjustmentCents, -1);
            db.exec('PRAGMA foreign_keys=ON; DELETE FROM "Product" WHERE id=701;');
            const historical = db.prepare('SELECT * FROM "OrderItem" WHERE id=1001').get();
            assert.equal(historical.productId, null);
            assert.equal(historical.productName, "Legacy Product");
            assert.equal(historical.unitPriceCents, 29);
            assert.equal(historical.lineTotalCents, 87);
            assert.equal(db.prepare('SELECT COUNT(*) AS n FROM "CartItem"').get().n, 0);
            assert.equal(db.prepare('SELECT COUNT(*) AS n FROM "ProductLike"').get().n, 0);
            assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
        } finally { db.close(); }
    } finally { await database.cleanup(); }
});

for (const [label, corrupt] of [
    ["negative historical quantity", 'UPDATE "OrderItem" SET quantity=-1 WHERE id=1001'],
    ["fractional cart quantity", 'UPDATE "CartItem" SET quantity=1.5 WHERE id=1301'],
    ["negative stored price", 'UPDATE "Product" SET price=-1 WHERE id=701'],
]) {
    it("rejects " + label + " without losing legacy records", async () => {
        const database = await createTestDatabase({ beforeMigration: ORDER_INTEGRITY_MIGRATION });
        try {
            historicalFixtures(database.file);
            const db = new DatabaseSync(database.file);
            db.exec(corrupt);
            const before = digest(readBusinessRows(db));
            db.close();
            assert.throws(() => deployMigrations(database.url), /order_integrity_requires_valid_legacy_data/);
            const after = new DatabaseSync(database.file, { readOnly: true });
            try { assert.equal(digest(readBusinessRows(after)), before); }
            finally { after.close(); }
        } finally { await database.cleanup(); }
    });
}
