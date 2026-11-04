export default async function teardown() {
    const apiPort = process.env.E2E_API_PORT || "4100";
    const response = await fetch(`http://127.0.0.1:${apiPort}/__test__/shutdown`, {
        method: "POST",
        headers: { "x-test-server-token": process.env.E2E_SERVER_TOKEN },
        signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Failed to clean up the browser test database.");
    await response.text();
}
