-- Run only through a NEW Prisma migration after the Phase 3 migrations.
-- Preflight must pass and the database must be backed up first.
PRAGMA foreign_keys=OFF;
BEGIN IMMEDIATE;
CREATE TABLE "new_Product" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "name" TEXT NOT NULL,
 "description" TEXT,
 "priceCents" INTEGER NOT NULL CHECK(typeof("priceCents")='integer' AND "priceCents" BETWEEN 0 AND 2147483647),
 "stock" INTEGER NOT NULL DEFAULT 0 CHECK(typeof("stock")='integer' AND "stock" BETWEEN 0 AND 2147483647),
 "tag" TEXT,
 "imageUrl" TEXT,
 "isActive" BOOLEAN NOT NULL DEFAULT true CHECK("isActive" IN (0,1)),
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "new_Order" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "userId" INTEGER NOT NULL,
 "totalCents" INTEGER NOT NULL CHECK(typeof("totalCents")='integer' AND "totalCents" BETWEEN 0 AND 2147483647),
 "status" TEXT NOT NULL DEFAULT 'Pending' CHECK("status" IN ('Pending','Paid','Shipped','Delivered','Cancelled')),
 "shippingAddress" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "idempotencyKey" TEXT,
 "requestHash" TEXT,
 "stockRestored" BOOLEAN NOT NULL DEFAULT false CHECK("stockRestored" IN (0,1)),
 CONSTRAINT "Order_userId_fkey" FOREIGN KEY("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "new_OrderItem" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "orderId" INTEGER NOT NULL,
 "productId" INTEGER NOT NULL,
 "quantity" INTEGER NOT NULL CHECK(typeof("quantity")='integer' AND "quantity" BETWEEN 1 AND 2147483647),
 "unitPriceCents" INTEGER NOT NULL CHECK(typeof("unitPriceCents")='integer' AND "unitPriceCents" BETWEEN 0 AND 2147483647),
 "productName" TEXT NOT NULL,
 CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("id","name","description","priceCents","stock","tag","imageUrl","createdAt")
 SELECT "id","name","description",CAST(ROUND("price"*100) AS INTEGER),"stock","tag","imageUrl","createdAt" FROM "Product";
INSERT INTO "new_Order" ("id","userId","totalCents","status","shippingAddress","createdAt","idempotencyKey","requestHash","stockRestored")
 SELECT "id","userId",CAST(ROUND("total"*100) AS INTEGER),"status","shippingAddress","createdAt","idempotencyKey","requestHash","stockRestored" FROM "Order";
-- For OLD orders this captures the name available at migration time.
-- Names before a historical rename cannot be reconstructed from this database.
INSERT INTO "new_OrderItem" ("id","orderId","productId","quantity","unitPriceCents","productName")
 SELECT i."id",i."orderId",i."productId",i."quantity",CAST(ROUND(i."price"*100) AS INTEGER),p."name"
 FROM "OrderItem" i JOIN "Product" p ON p."id"=i."productId";
DROP TABLE "OrderItem";
DROP TABLE "Order";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
ALTER TABLE "new_Order" RENAME TO "Order";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
-- Abort the transaction if a foreign key was broken during copying.
CREATE TEMP TABLE "_phase4_fk_guard" ("ok" INTEGER CHECK("ok"=1));
INSERT INTO "_phase4_fk_guard" SELECT CASE WHEN EXISTS(SELECT 1 FROM pragma_foreign_key_check) THEN 0 ELSE 1 END;
DROP TABLE "_phase4_fk_guard";
COMMIT;
PRAGMA foreign_keys=ON;
