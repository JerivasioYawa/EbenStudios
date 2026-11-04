import path from "node:path";
import { createTestDatabase } from "../test-support/database.js";
import { snapshotBeforeInvoices, verifyInvoiceMigration } from "../test-support/invoice-migration.js";

if (!process.argv[2]) throw new Error("Pass a pre-invoice SQLite backup path.");
const source = path.resolve(process.argv[2]), before = snapshotBeforeInvoices(source);
const copy = await createTestDatabase({ sourceDatabase: source });
try { console.log(JSON.stringify(verifyInvoiceMigration(copy.file, before))); }
finally { await copy.cleanup(); }
