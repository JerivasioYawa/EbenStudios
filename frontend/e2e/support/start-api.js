import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import { backendDirectory, createTestDatabase } from "../../../backend/test-support/database.js";

const originalDirectory = process.cwd();
let database, prisma, server, stopping;

function shutdown() {
    stopping ||= (async () => {
        server?.close();
        await prisma?.$disconnect();
        process.chdir(originalDirectory);
        await database?.cleanup();
    })();
    return stopping;
}

try {
    if (!process.env.E2E_SERVER_TOKEN || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
        throw new Error("Start this test API through Playwright so it receives disposable test credentials.");
    }
    database = await createTestDatabase();
    process.env.DATABASE_URL = database.url;
    execFileSync(process.execPath, [path.join(backendDirectory, "prisma/seed.js")], {
        cwd: backendDirectory,
        env: process.env,
        stdio: "pipe",
        timeout: 60_000,
    });
    // The application's upload middleware also uses this disposable directory.
    process.chdir(database.directory);
    const { default: app } = await import("../../../backend/src/app.js");
    ({ prisma } = await import("../../../backend/src/lib/prisma.js"));

    server = createServer((req, res) => {
        // This route exists only in the test server, for cleanup before Windows kills the server tree.
        if (req.method === "POST" && req.url === "/__test__/shutdown"
            && req.headers["x-test-server-token"] === process.env.E2E_SERVER_TOKEN) {
            shutdown().then(() => res.end("Test API stopped."), (error) => {
                console.error(error);
                res.writeHead(500).end("Test API cleanup failed.");
            });
            return;
        }
        app(req, res);
    });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(Number(process.env.PORT), "127.0.0.1", resolve);
    });
    console.log("Browser test API ready with a temporary database.");

    for (const signal of ["SIGINT", "SIGTERM"]) {
        process.once(signal, () => {
            shutdown().then(() => process.exit(0), () => process.exit(1));
        });
    }
} catch (error) {
    await shutdown();
    throw error;
}
