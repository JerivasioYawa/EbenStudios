import assert from "node:assert/strict";
import { it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createTestDatabase, deployMigrations } from "../test-support/database.js";
import { ADMIN_MIGRATION, snapshotBeforeAdmin, verifyAdminMigration } from "../test-support/admin-migration.js";

it("preserves all historical fields, relationships, integer guards and sequences during admin backfill", async () => {
    const database = await createTestDatabase({ beforeMigration: ADMIN_MIGRATION });
    try {
        const db = new DatabaseSync(database.file);
        db.exec(`
            INSERT INTO "User" (id,name,email,password) VALUES (10,'Legacy Customer','legacy@example.test','test-only-hash');
            INSERT INTO "Product" (id,name,priceCents,stock) VALUES (20,'Historical Product',29,7);
            INSERT INTO "Cart" (id,userId) VALUES (30,10);
            INSERT INTO "CartItem" (cartId,productId,quantity) VALUES (30,20,2);
            INSERT INTO "ProductLike" (userId,productId) VALUES (10,20);
        `);
        for (const [index, status] of ["Pending", "Paid", "Shipped", "Delivered", "Cancelled"].entries()) {
            db.prepare('INSERT INTO "Order" (id,userId,totalCents,customerName,customerEmail,idempotencyKey,status) VALUES (?,10,87,?,?,?,?)')
                .run(100 + index, "Historical Name", "historical@example.test", "legacy-" + index, status);
            db.prepare('INSERT INTO "OrderItem" (orderId,productId,quantity,productName,unitPriceCents,lineTotalCents) VALUES (?,20,3,?,29,87)').run(100 + index, "Saved Original Name");
        }
        db.exec("UPDATE sqlite_sequence SET seq=9000 WHERE name IN ('Product','Order','OrderItem','CartItem')");
        db.close();
        const before = snapshotBeforeAdmin(database.file);
        deployMigrations(database.url);
        assert.equal(verifyAdminMigration(database.file, before).preserved, true);
        const after = new DatabaseSync(database.file);
        try {
            assert.throws(() => after.exec('UPDATE "Product" SET stock=-1 WHERE id=20'), /CHECK/);
            assert.throws(() => after.exec('UPDATE "OrderItem" SET quantity=1.5'), /CHECK/);
            assert.throws(() => after.exec('UPDATE "Product" SET lowStockThreshold=-1'), /CHECK/);
            assert.equal(after.prepare('SELECT stock FROM "Product" WHERE id=20').get().stock, 7, "Legacy cancellations must not change current inventory");
        } finally { after.close(); }
    } finally { await database.cleanup(); }
});
