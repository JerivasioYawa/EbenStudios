import path from "node:path";
import { createTestDatabase } from "../test-support/database.js";
import { snapshotBeforeAdmin, verifyAdminMigration } from "../test-support/admin-migration.js";

if (!process.argv[2]) throw new Error("Pass a pre-admin-management SQLite backup path.");
const source = path.resolve(process.argv[2]), before = snapshotBeforeAdmin(source);
const copy = await createTestDatabase({ sourceDatabase: source });
try { console.log(JSON.stringify(verifyAdminMigration(copy.file, before))); }
finally { await copy.cleanup(); }
