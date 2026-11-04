import { AxiosError } from "axios";
import { beforeEach, expect, it, vi } from "vitest";
import api from "./api";
import { getSessionToken, SESSION_CHANGED, SESSION_EXPIRED_MESSAGE } from "./session";

beforeEach(() => { localStorage.setItem("eben_auth_token", "session-a"); });

function unauthorized(config) {
    return new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, null, {
        status: 401, data: { message: "Invalid or expired token" }, config,
    });
}

it("centrally expires an authenticated session on a 401", async () => {
    const changed = vi.fn();
    window.addEventListener(SESSION_CHANGED, changed);
    try {
        await expect(api.get("/cart", { adapter: async (config) => { throw unauthorized(config); } }))
            .rejects.toThrow(SESSION_EXPIRED_MESSAGE);
        expect(getSessionToken()).toBeNull();
        expect(changed).toHaveBeenCalledTimes(1);
    } finally { window.removeEventListener(SESSION_CHANGED, changed); }
});

it("does not expire the session for an ordinary failed public login", async () => {
    await expect(api.post("/auth/login", {}, { skipAuth: true, adapter: async (config) => {
        expect(config.headers.Authorization).toBeUndefined();
        throw unauthorized(config);
    } })).rejects.toThrow("Unauthorized");
    expect(getSessionToken()).toBe("session-a");
});

it("ignores a late 401 from a previous account", async () => {
    let rejectRequest;
    let started;
    const ready = new Promise((resolve) => { started = resolve; });
    const response = api.get("/cart", { adapter: (config) => new Promise((resolve, reject) => {
        rejectRequest = () => reject(unauthorized(config));
        started();
    }) }).catch((error) => error);
    await ready;
    localStorage.setItem("eben_auth_token", "session-b");
    rejectRequest();
    expect((await response).response.status).toBe(401);
    expect(getSessionToken()).toBe("session-b");
});

it("rejects a queued request from a previous account before it reaches the API", async () => {
    localStorage.setItem("eben_auth_token", "session-b");
    const adapter = vi.fn();
    await expect(api.post("/cart/items", { productId: 1, quantity: 1 }, { sessionToken: "session-a", adapter }))
        .rejects.toThrow(/account changed/i);
    expect(adapter).not.toHaveBeenCalled();
});
