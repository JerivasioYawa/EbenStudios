import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const backendDirectory = fileURLToPath(new URL("../", import.meta.url));

export async function createTestDatabase() {
    const prefix = "eben-studios-test-";
    const directory = await mkdtemp(path.join(tmpdir(), prefix));
    const databasePath = path.join(directory, "test.db");
    const url = `file:${databasePath.replaceAll("\\", "/")}`;

    async function cleanup() {
        const target = path.resolve(directory);
        if (path.dirname(target) !== path.resolve(tmpdir()) || !path.basename(target).startsWith(prefix)) {
            throw new Error("Refusing to remove a directory outside the test database location.");
        }
        await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }

    try {
        // Creating the file first also supports Prisma 5's SQLite engine on Windows.
        await writeFile(databasePath, "", { flag: "wx" });
        const result = spawnSync(process.execPath, [
            path.join(backendDirectory, "node_modules/prisma/build/index.js"),
            "migrate", "deploy", "--schema", path.join(backendDirectory, "prisma/schema.prisma"),
        ], {
            cwd: backendDirectory,
            env: { ...process.env, DATABASE_URL: url },
            encoding: "utf8",
            timeout: 60_000,
        });

        if (result.error) throw result.error;
        if (result.status !== 0) {
            throw new Error(`Test database migrations failed:\n${result.stdout}\n${result.stderr}`);
        }
        return { directory, url, cleanup };
    } catch (error) {
        await cleanup();
        throw error;
    }
}
