-- Additive migration: retain Phase 5 CHECK constraints, rows, references and sequences.
BEGIN IMMEDIATE;

-- CreateTable
CREATE TABLE "AdminAudit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "actorId" INTEGER,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "reason" TEXT,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER,
    "productName" TEXT NOT NULL,
    "actorId" INTEGER,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "orderId" INTEGER,
    "kind" TEXT NOT NULL DEFAULT 'Manual',
    "delta" INTEGER NOT NULL CHECK (typeof("delta")='integer' AND "delta"<>0 AND "delta" BETWEEN -2147483647 AND 2147483647),
    "beforeStock" INTEGER NOT NULL CHECK (typeof("beforeStock")='integer' AND "beforeStock" BETWEEN 0 AND 2147483647),
    "afterStock" INTEGER NOT NULL CHECK (typeof("afterStock")='integer' AND "afterStock" BETWEEN 0 AND 2147483647 AND "afterStock"="beforeStock"+"delta"),
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockAdjustment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockAdjustment_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockAdjustment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL CHECK (typeof("amountCents")='integer' AND "amountCents" BETWEEN 0 AND 2147483647),
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "reference" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentRecord_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Add columns without rebuilding the existing business tables.
ALTER TABLE "Product" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "Product" ADD COLUMN "lowStockThreshold" INTEGER NOT NULL DEFAULT 5
    CHECK (typeof("lowStockThreshold")='integer' AND "lowStockThreshold" BETWEEN 0 AND 2147483647);
ALTER TABLE "Order" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'Pending'
    CHECK ("paymentStatus" IN ('Pending','Unverified','Confirmed','RefundRequired','Refunded'));
ALTER TABLE "Order" ADD COLUMN "fulfilmentStatus" TEXT NOT NULL DEFAULT 'Unfulfilled'
    CHECK ("fulfilmentStatus" IN ('Unfulfilled','Processing','Shipped','Delivered','Cancelled'));
ALTER TABLE "Order" ADD COLUMN "stockRestoredAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "shippingReference" TEXT;
-- Legacy status is not evidence of a confirmed payment. Do not fabricate receipts.
UPDATE "Order" SET "paymentStatus"='Unverified' WHERE "status" IN ('Paid','Shipped','Delivered');
UPDATE "Order" SET "fulfilmentStatus"="status" WHERE "status" IN ('Shipped','Delivered','Cancelled');
-- Preserve existing inventory and leave unknown restoration times null.
-- Cancelled orders are terminal; repeated cancellation never restores stock again.
INSERT INTO "OrderEvent" ("orderId","actorName","actorEmail","type","toStatus","note","createdAt")
SELECT "id",'Migration','system@eben.local','Imported',"fulfilmentStatus",
    'Legacy order imported. Prior payments and cancellation stock restoration were not independently verified.',"createdAt" FROM "Order";
CREATE INDEX "Order_paymentStatus_fulfilmentStatus_createdAt_idx" ON "Order"("paymentStatus","fulfilmentStatus","createdAt");
CREATE INDEX "Product_archivedAt_createdAt_idx" ON "Product"("archivedAt","createdAt");

-- CreateIndex
CREATE INDEX "AdminAudit_entityType_entityId_createdAt_idx" ON "AdminAudit"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAudit_actorId_createdAt_idx" ON "AdminAudit"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "StockAdjustment_productId_createdAt_idx" ON "StockAdjustment"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockAdjustment_orderId_idx" ON "StockAdjustment"("orderId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_reference_key" ON "PaymentRecord"("reference");

-- CreateIndex
CREATE INDEX "PaymentRecord_createdAt_idx" ON "PaymentRecord"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_orderId_kind_key" ON "PaymentRecord"("orderId", "kind");

COMMIT;
