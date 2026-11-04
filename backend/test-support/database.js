import { spawnSync } from "node:child_process";
import { copyFile, cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const backendDirectory = fileURLToPath(new URL("../", import.meta.url));
const schema = path.join(backendDirectory, "prisma/schema.prisma");

export function deployMigrations(url, schemaPath = schema) {
    const result = spawnSync(process.execPath, [
        path.join(backendDirectory, "node_modules/prisma/build/index.js"),
        "migrate", "deploy", "--schema", schemaPath,
    ], {
        cwd: backendDirectory, env: { ...process.env, DATABASE_URL: url },
        encoding: "utf8", timeout: 60_000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error("Test database migrations failed:\n" + result.stdout + "\n" + result.stderr);
}

export async function createTestDatabase({ beforeMigration, throughMigration, sourceDatabase } = {}) {
    const prefix = "eben-studios-test-";
    const directory = await mkdtemp(path.join(tmpdir(), prefix));
    const file = path.join(directory, "test.db");
    const url = "file:" + file.replaceAll("\\", "/");

    async function cleanup() {
        const target = path.resolve(directory);
        if (path.dirname(target) !== path.resolve(tmpdir()) || !path.basename(target).startsWith(prefix)) {
            throw new Error("Refusing to remove a directory outside the test database location.");
        }
        await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }

    try {
        if (sourceDatabase) await copyFile(sourceDatabase, file);
        else await writeFile(file, "", { flag: "wx" });
        let schemaPath = schema;
        if (beforeMigration || throughMigration) {
            if (beforeMigration && throughMigration) throw new Error("Choose one migration boundary.");
            const boundary = beforeMigration || throughMigration;
            const source = path.join(backendDirectory, "prisma/migrations");
            const names = await readdir(source);
            if (!names.includes(boundary)) throw new Error("Unknown migration boundary.");
            const target = path.join(directory, "prisma");
            await mkdir(path.join(target, "migrations"), { recursive: true });
            await copyFile(schema, path.join(target, "schema.prisma"));
            await copyFile(path.join(source, "migration_lock.toml"), path.join(target, "migrations/migration_lock.toml"));
            for (const name of names.filter(name => (beforeMigration ? name < boundary : name <= boundary) && /^\d{14}_/.test(name))) {
                await cp(path.join(source, name), path.join(target, "migrations", name), { recursive: true });
            }
            schemaPath = path.join(target, "schema.prisma");
        }
        deployMigrations(url, schemaPath);
        return { directory, file, url, schemaPath, cleanup };
    } catch (error) {
        await cleanup();
        throw error;
    }
}
