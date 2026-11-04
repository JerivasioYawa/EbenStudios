import assert from "node:assert/strict";
import { it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createTestDatabase, deployMigrations } from "../test-support/database.js";
import { INVOICE_MIGRATION, snapshotBeforeInvoices, verifyInvoiceMigration } from "../test-support/invoice-migration.js";

it("adds empty invoice tables without changing existing orders, payments, audits, inventory or constraints", async () => {
    const database = await createTestDatabase({ beforeMigration: INVOICE_MIGRATION });
    try {
        const db = new DatabaseSync(database.file);
        db.exec(`
            PRAGMA foreign_keys=ON;
            INSERT INTO "User" (id,name,email,password,role) VALUES (1,'Admin','admin@example.test','test-only','ADMIN'),(2,'Customer','customer@example.test','test-only','CUSTOMER');
            INSERT INTO "Product" (id,name,priceCents,stock) VALUES (10,'Saved Product',29,5);
            INSERT INTO "Order" (id,userId,totalCents,customerName,customerEmail,idempotencyKey,status,paymentStatus,shippingAddress)
                VALUES (20,2,87,'Original Customer','original@example.test','legacy-key','Paid','Confirmed','Saved Address');
            INSERT INTO "OrderItem" (id,orderId,productId,productName,quantity,unitPriceCents,lineTotalCents) VALUES (30,20,10,'Original Name',3,29,87);
            INSERT INTO "Cart" (id,userId) VALUES (40,2);
            INSERT INTO "CartItem" (cartId,productId,quantity) VALUES (40,10,1);
            INSERT INTO "ProductLike" (userId,productId) VALUES (2,10);
            INSERT INTO "AdminAudit" (actorId,actorName,actorEmail,action,entityType,entityId,reason) VALUES (1,'Admin','admin@example.test','Stock adjusted','Product',10,'Initial count');
            INSERT INTO "StockAdjustment" (productId,productName,actorId,actorName,actorEmail,delta,beforeStock,afterStock,reason) VALUES (10,'Saved Product',1,'Admin','admin@example.test',5,0,5,'Initial count');
            INSERT INTO "OrderEvent" (orderId,actorId,actorName,actorEmail,type,note) VALUES (20,1,'Admin','admin@example.test','Payment confirmed','Saved reference');
            INSERT INTO "PaymentRecord" (orderId,actorId,actorName,actorEmail,kind,amountCents,reference) VALUES (20,1,'Admin','admin@example.test','Confirmation',87,'SAVED-REFERENCE');
            UPDATE sqlite_sequence SET seq=9000 WHERE name IN ('Order','Product','OrderItem','PaymentRecord');
        `);
        db.close();
        const before = snapshotBeforeInvoices(database.file);
        deployMigrations(database.url);
        assert.equal(verifyInvoiceMigration(database.file, before).preserved, true);
    } finally { await database.cleanup(); }
});
