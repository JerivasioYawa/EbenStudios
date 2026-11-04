-- Add invoice tables only; preserve all existing business rows and constraints.
BEGIN IMMEDIATE;

-- CreateTable
CREATE TABLE "Invoice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "orderPlacedAt" DATETIME NOT NULL,
    "customerId" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1 CHECK (typeof("revision")='integer' AND "revision" BETWEEN 1 AND 2147483647),
    "supersedesId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'Draft' CHECK ("status" IN ('Draft','Issued','Voided')),
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" INTEGER,
    "issuedByName" TEXT NOT NULL,
    "issuedByEmail" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "sellerAddress" TEXT NOT NULL,
    "sellerEmail" TEXT NOT NULL,
    "sellerPhone" TEXT,
    "sellerRegistrationNumber" TEXT,
    "sellerTaxNumber" TEXT,
    "billingName" TEXT NOT NULL,
    "billingAddress" TEXT NOT NULL,
    "billingEmail" TEXT NOT NULL,
    "billingRegistrationNumber" TEXT,
    "billingTaxNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ZAR' CHECK ("currency"='ZAR'),
    "totalCents" INTEGER NOT NULL CHECK (typeof("totalCents")='integer' AND "totalCents" BETWEEN 0 AND 2147483647),
    "adjustmentCents" INTEGER NOT NULL DEFAULT 0 CHECK (typeof("adjustmentCents")='integer' AND "adjustmentCents" BETWEEN -2147483647 AND 2147483647),
    "notes" TEXT,
    "voidedAt" DATETIME,
    "voidReason" TEXT,
    CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "invoiceId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL CHECK (typeof("position")='integer' AND "position" BETWEEN 1 AND 2147483647),
    "sourceOrderItemId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "productDescription" TEXT,
    "quantity" INTEGER NOT NULL CHECK (typeof("quantity")='integer' AND "quantity" BETWEEN 1 AND 2147483647),
    "unitPriceCents" INTEGER NOT NULL CHECK (typeof("unitPriceCents")='integer' AND "unitPriceCents" BETWEEN 0 AND 2147483647),
    "lineTotalCents" INTEGER NOT NULL CHECK (typeof("lineTotalCents")='integer' AND "lineTotalCents" BETWEEN 0 AND 2147483647 AND "lineTotalCents"="unitPriceCents"*"quantity"),
    CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "invoiceId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "relatedInvoiceId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InvoiceEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" INTEGER NOT NULL DEFAULT 0 CHECK (typeof("value")='integer' AND "value" BETWEEN 0 AND 2147483647)
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_supersedesId_key" ON "Invoice"("supersedesId");

-- CreateIndex
CREATE INDEX "Invoice_customerId_issuedAt_idx" ON "Invoice"("customerId", "issuedAt");

-- CreateIndex
CREATE INDEX "Invoice_status_issuedAt_idx" ON "Invoice"("status", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_revision_key" ON "Invoice"("orderId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLine_invoiceId_position_key" ON "InvoiceLine"("invoiceId", "position");

-- CreateIndex
CREATE INDEX "InvoiceEvent_invoiceId_createdAt_idx" ON "InvoiceEvent"("invoiceId", "createdAt");

-- Issued invoice snapshots are append-only; changes use linked replacements.
CREATE UNIQUE INDEX "Invoice_one_issued_per_order" ON "Invoice"("orderId") WHERE "status"='Issued';
CREATE TRIGGER "Invoice_creation_guard" BEFORE INSERT ON "Invoice"
WHEN NEW."status"<>'Draft' OR NEW."voidedAt" IS NOT NULL OR NEW."voidReason" IS NOT NULL
 OR NEW."customerId"<>(SELECT "userId" FROM "Order" WHERE "id"=NEW."orderId")
 OR (NEW."supersedesId" IS NULL AND NEW."revision"<>1)
 OR (NEW."supersedesId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Invoice" p WHERE p."id"=NEW."supersedesId" AND p."status"='Voided'
    AND p."orderId"=NEW."orderId" AND p."customerId"=NEW."customerId" AND NEW."revision"=p."revision"+1
    AND p."totalCents"=NEW."totalCents" AND p."adjustmentCents"=NEW."adjustmentCents" AND p."currency"=NEW."currency"))
BEGIN SELECT RAISE(ABORT,'Invalid invoice origin or correction'); END;
CREATE TRIGGER "Invoice_snapshot_immutable" BEFORE UPDATE ON "Invoice" WHEN NEW."id" IS NOT OLD."id" OR NEW."number" IS NOT OLD."number" OR NEW."orderId" IS NOT OLD."orderId" OR NEW."orderNumber" IS NOT OLD."orderNumber" OR NEW."orderPlacedAt" IS NOT OLD."orderPlacedAt" OR NEW."customerId" IS NOT OLD."customerId" OR NEW."revision" IS NOT OLD."revision" OR NEW."supersedesId" IS NOT OLD."supersedesId" OR NEW."issuedAt" IS NOT OLD."issuedAt" OR NEW."issuedByName" IS NOT OLD."issuedByName" OR NEW."issuedByEmail" IS NOT OLD."issuedByEmail" OR NEW."sellerName" IS NOT OLD."sellerName" OR NEW."sellerAddress" IS NOT OLD."sellerAddress" OR NEW."sellerEmail" IS NOT OLD."sellerEmail" OR NEW."sellerPhone" IS NOT OLD."sellerPhone" OR NEW."sellerRegistrationNumber" IS NOT OLD."sellerRegistrationNumber" OR NEW."sellerTaxNumber" IS NOT OLD."sellerTaxNumber" OR NEW."billingName" IS NOT OLD."billingName" OR NEW."billingAddress" IS NOT OLD."billingAddress" OR NEW."billingEmail" IS NOT OLD."billingEmail" OR NEW."billingRegistrationNumber" IS NOT OLD."billingRegistrationNumber" OR NEW."billingTaxNumber" IS NOT OLD."billingTaxNumber" OR NEW."currency" IS NOT OLD."currency" OR NEW."totalCents" IS NOT OLD."totalCents" OR NEW."adjustmentCents" IS NOT OLD."adjustmentCents" OR NEW."notes" IS NOT OLD."notes" OR (NEW."issuedById" IS NOT OLD."issuedById" AND NEW."issuedById" IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'Issued invoice snapshots are immutable'); END;
CREATE TRIGGER "Invoice_lifecycle" BEFORE UPDATE ON "Invoice"
WHEN NOT (
 (OLD."status"='Draft' AND NEW."status"='Issued' AND NEW."voidedAt" IS NULL AND NEW."voidReason" IS NULL
  AND EXISTS (SELECT 1 FROM "InvoiceLine" WHERE "invoiceId"=OLD."id")
  AND NEW."totalCents"=(SELECT COALESCE(SUM("lineTotalCents"),0) FROM "InvoiceLine" WHERE "invoiceId"=OLD."id")+NEW."adjustmentCents")
 OR (OLD."status"='Issued' AND NEW."status"='Voided' AND NEW."voidedAt" IS NOT NULL AND LENGTH(TRIM(NEW."voidReason"))>0)
 OR (OLD."status"=NEW."status" AND OLD."voidedAt" IS NEW."voidedAt" AND OLD."voidReason" IS NEW."voidReason"))
BEGIN SELECT RAISE(ABORT,'Invalid invoice lifecycle or total'); END;
CREATE TRIGGER "Invoice_no_delete" BEFORE DELETE ON "Invoice"
BEGIN SELECT RAISE(ABORT,'Invoices must be voided, not deleted'); END;
CREATE TRIGGER "InvoiceLine_insert_draft_only" BEFORE INSERT ON "InvoiceLine"
WHEN (SELECT "status" FROM "Invoice" WHERE "id"=NEW."invoiceId")<>'Draft'
BEGIN SELECT RAISE(ABORT,'Invoice lines are sealed'); END;
CREATE TRIGGER "InvoiceLine_no_update" BEFORE UPDATE ON "InvoiceLine"
BEGIN SELECT RAISE(ABORT,'Invoice lines are immutable'); END;
CREATE TRIGGER "InvoiceLine_no_delete" BEFORE DELETE ON "InvoiceLine"
BEGIN SELECT RAISE(ABORT,'Invoice lines are immutable'); END;
CREATE TRIGGER "InvoiceEvent_no_update" BEFORE UPDATE ON "InvoiceEvent"
WHEN NEW."id" IS NOT OLD."id" OR NEW."invoiceId" IS NOT OLD."invoiceId" OR NEW."actorName" IS NOT OLD."actorName"
 OR NEW."actorEmail" IS NOT OLD."actorEmail" OR NEW."type" IS NOT OLD."type" OR NEW."reason" IS NOT OLD."reason"
 OR NEW."relatedInvoiceId" IS NOT OLD."relatedInvoiceId" OR NEW."createdAt" IS NOT OLD."createdAt"
 OR (NEW."actorId" IS NOT OLD."actorId" AND NEW."actorId" IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'Invoice history is immutable'); END;
CREATE TRIGGER "InvoiceEvent_no_delete" BEFORE DELETE ON "InvoiceEvent"
BEGIN SELECT RAISE(ABORT,'Invoice history is immutable'); END;
COMMIT;
