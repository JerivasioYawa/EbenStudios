-- Convert stored rand amounts to integer cents, rounded to the nearest cent.
-- Historical unit prices come from OrderItem.price, never today's Product.price.
-- Preserve original order totals; adjustmentCents reconciles legacy header/line differences.
-- Snapshot currently available product/customer metadata; older names were not previously stored.
PRAGMA foreign_keys=OFF;
BEGIN IMMEDIATE;

CREATE TABLE "_order_integrity_guard" (
    "valid" INTEGER NOT NULL CONSTRAINT "order_integrity_requires_valid_legacy_data" CHECK ("valid" = 1)
);
-- Stop for orphaned relationships or values that cannot be represented safely.
INSERT INTO "_order_integrity_guard" SELECT 0 FROM pragma_foreign_key_check LIMIT 1;
INSERT INTO "_order_integrity_guard"
SELECT CASE WHEN
    NOT EXISTS (SELECT 1 FROM "Product" WHERE
        typeof("price") NOT IN ('integer','real') OR "price" < 0 OR ROUND("price"*100) > 2147483647 OR
        typeof("stock") <> 'integer' OR "stock" < 0 OR "stock" > 2147483647)
    AND NOT EXISTS (SELECT 1 FROM "Order" WHERE
        typeof("total") NOT IN ('integer','real') OR "total" < 0 OR ROUND("total"*100) > 2147483647)
    AND NOT EXISTS (SELECT 1 FROM "OrderItem" WHERE
        typeof("quantity") <> 'integer' OR "quantity" <= 0 OR "quantity" > 2147483647 OR
        typeof("price") NOT IN ('integer','real') OR "price" < 0 OR ROUND("price"*100) > 2147483647 OR
        CAST(ROUND("price"*100) AS INTEGER)*"quantity" > 2147483647)
    AND NOT EXISTS (SELECT 1 FROM "CartItem" WHERE
        typeof("quantity") <> 'integer' OR "quantity" <= 0 OR "quantity" > 2147483647)
THEN 1 ELSE 0 END;
CREATE TABLE "_order_integrity_sequences" AS
SELECT "name","seq" FROM sqlite_sequence WHERE "name" IN ('Product','Order','OrderItem','CartItem');

CREATE TABLE "new_Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL, "description" TEXT,
    "priceCents" INTEGER NOT NULL CHECK (typeof("priceCents")='integer' AND "priceCents" BETWEEN 0 AND 2147483647),
    "stock" INTEGER NOT NULL DEFAULT 0 CHECK (typeof("stock")='integer' AND "stock" BETWEEN 0 AND 2147483647),
    "tag" TEXT, "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Product" ("id","name","description","priceCents","stock","tag","imageUrl","createdAt")
SELECT "id","name","description",CAST(ROUND("price"*100) AS INTEGER),"stock","tag","imageUrl","createdAt" FROM "Product";

CREATE TABLE "new_Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL CHECK (typeof("totalCents")='integer' AND "totalCents" BETWEEN 0 AND 2147483647),
    "currency" TEXT NOT NULL DEFAULT 'ZAR' CHECK ("currency"='ZAR'),
    "adjustmentCents" INTEGER NOT NULL DEFAULT 0 CHECK (typeof("adjustmentCents")='integer' AND "adjustmentCents" BETWEEN -2147483647 AND 2147483647),
    "customerName" TEXT NOT NULL, "customerEmail" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending', "shippingAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("id","userId","totalCents","currency","adjustmentCents","customerName","customerEmail","idempotencyKey","status","shippingAddress","createdAt")
SELECT o."id",o."userId",CAST(ROUND(o."total"*100) AS INTEGER),'ZAR',
    CAST(ROUND(o."total"*100) AS INTEGER) - COALESCE(
        (SELECT SUM(CAST(ROUND(i."price"*100) AS INTEGER)*i."quantity") FROM "OrderItem" i WHERE i."orderId"=o."id"),0),
    u."name",u."email",'legacy-order-'||o."id",o."status",o."shippingAddress",o."createdAt"
FROM "Order" o LEFT JOIN "User" u ON u."id"=o."userId";

CREATE TABLE "new_OrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL, "productId" INTEGER,
    "quantity" INTEGER NOT NULL CHECK (typeof("quantity")='integer' AND "quantity" BETWEEN 1 AND 2147483647),
    "productName" TEXT NOT NULL, "productDescription" TEXT, "productImageUrl" TEXT,
    "unitPriceCents" INTEGER NOT NULL CHECK (typeof("unitPriceCents")='integer' AND "unitPriceCents" BETWEEN 0 AND 2147483647),
    "lineTotalCents" INTEGER NOT NULL CHECK (
        typeof("lineTotalCents")='integer' AND "lineTotalCents" BETWEEN 0 AND 2147483647 AND "lineTotalCents"="unitPriceCents"*"quantity"),
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("id","orderId","productId","quantity","productName","productDescription","productImageUrl","unitPriceCents","lineTotalCents")
SELECT i."id",i."orderId",i."productId",i."quantity",p."name",p."description",p."imageUrl",
    CAST(ROUND(i."price"*100) AS INTEGER),CAST(ROUND(i."price"*100) AS INTEGER)*i."quantity"
FROM "OrderItem" i LEFT JOIN "Product" p ON p."id"=i."productId";

CREATE TABLE "new_CartItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cartId" INTEGER NOT NULL, "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL CHECK (typeof("quantity")='integer' AND "quantity" BETWEEN 1 AND 2147483647),
    CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CartItem" ("id","cartId","productId","quantity")
SELECT "id","cartId","productId","quantity" FROM "CartItem";

-- Cardinality checks run before any original table is removed.
INSERT INTO "_order_integrity_guard" SELECT CASE WHEN
    (SELECT COUNT(*) FROM "new_Product")=(SELECT COUNT(*) FROM "Product") AND
    (SELECT COUNT(*) FROM "new_Order")=(SELECT COUNT(*) FROM "Order") AND
    (SELECT COUNT(*) FROM "new_OrderItem")=(SELECT COUNT(*) FROM "OrderItem") AND
    (SELECT COUNT(*) FROM "new_CartItem")=(SELECT COUNT(*) FROM "CartItem")
THEN 1 ELSE 0 END;

DROP TABLE "OrderItem";
DROP TABLE "CartItem";
DROP TABLE "Order";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
ALTER TABLE "new_Order" RENAME TO "Order";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
ALTER TABLE "new_CartItem" RENAME TO "CartItem";
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");
CREATE UNIQUE INDEX "Order_userId_idempotencyKey_key" ON "Order"("userId","idempotencyKey");
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId","createdAt");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "CartItem"("cartId","productId");
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- Keep AUTOINCREMENT high-water marks, including IDs of previously deleted records.
INSERT INTO sqlite_sequence("name","seq")
SELECT s."name",s."seq" FROM "_order_integrity_sequences" s
WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence q WHERE q."name"=s."name");
UPDATE sqlite_sequence SET "seq"=MAX("seq",COALESCE(
    (SELECT s."seq" FROM "_order_integrity_sequences" s WHERE s."name"=sqlite_sequence."name"),"seq"))
WHERE "name" IN ('Product','Order','OrderItem','CartItem');
INSERT INTO "_order_integrity_guard" SELECT 0 FROM pragma_foreign_key_check LIMIT 1;
DROP TABLE "_order_integrity_sequences";
DROP TABLE "_order_integrity_guard";
COMMIT;
PRAGMA foreign_keys=ON;
