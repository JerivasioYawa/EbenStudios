import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

const frontendPort = process.env.E2E_PORT || "4173";
const apiPort = process.env.E2E_API_PORT || "4100";
const baseURL = `http://127.0.0.1:${frontendPort}`;
const apiURL = `http://127.0.0.1:${apiPort}`;

// Workers and test servers inherit these values; local .env credentials are never used.
process.env.E2E_ADMIN_EMAIL ||= "admin@eben.test";
process.env.E2E_ADMIN_PASSWORD ||= randomBytes(24).toString("hex");
process.env.E2E_SERVER_TOKEN ||= randomBytes(32).toString("hex");

export default defineConfig({
    testDir: "./e2e",
    testMatch: "**/*.spec.js",
    fullyParallel: false,
    workers: 1,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    timeout: 30_000,
    reporter: [["list"], ["html", { open: "never" }]],
    globalTeardown: "./e2e/support/teardown.js",
    use: {
        baseURL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: [
        {
            command: "node e2e/support/start-api.js",
            url: `${apiURL}/api/health`,
            reuseExistingServer: false,
            timeout: 120_000,
            env: {
                NODE_ENV: "test",
                PORT: apiPort,
                JWT_SECRET: process.env.E2E_SERVER_TOKEN,
                ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL,
                ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
                INVOICE_SELLER_NAME: "Eben Browser Test Seller",
                INVOICE_SELLER_ADDRESS: "7 Test Seller Road, Cape Town",
                INVOICE_SELLER_EMAIL: "seller@invoice.test",
                INVOICE_SELLER_PHONE: "",
                INVOICE_SELLER_REGISTRATION_NUMBER: "",
                INVOICE_SELLER_TAX_NUMBER: "",
            },
        },
        {
            command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
            url: baseURL,
            reuseExistingServer: false,
            timeout: 60_000,
            env: { VITE_API_URL: `${apiURL}/api` },
        },
    ],
});
