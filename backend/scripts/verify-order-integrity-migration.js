import path from "node:path";
import { createTestDatabase } from "../test-support/database.js";
import { ORDER_INTEGRITY_MIGRATION, legacySnapshot, verifyMigratedDatabase } from "../test-support/order-integrity-migration.js";

const backup = process.argv[2];
if (!backup) throw new Error("Pass the path to a pre-integrity SQLite backup.");
const source = path.resolve(backup);
const before = legacySnapshot(source);
const copy = await createTestDatabase({ sourceDatabase: source, throughMigration: ORDER_INTEGRITY_MIGRATION });
try {
    console.log(JSON.stringify(verifyMigratedDatabase(copy.file, before)));
} finally { await copy.cleanup(); }
