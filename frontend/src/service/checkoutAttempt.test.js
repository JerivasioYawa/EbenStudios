import { expect, it, vi } from "vitest";
import { checkoutAttempt, readCheckoutAttempt, completeCheckoutAttempt, discardCheckoutAttempt } from "./checkoutAttempt";

const items = [{ id: 2, quantity: 1 }, { id: 1, quantity: 3 }];

it("persists a checkout key across reloads and item ordering, scoped to one account", async () => {
    const first = checkoutAttempt(1, items, " Test Road ");
    vi.resetModules();
    const reloaded = await import("./checkoutAttempt");
    expect(reloaded.checkoutAttempt(1, [...items].reverse(), "Test Road")).toEqual(first);
    expect(checkoutAttempt(2, items, "Test Road").key).not.toBe(first.key);
    expect(readCheckoutAttempt(1)).toEqual(first);
});

it("uses a new key when contents or shipping change and does not clear a newer intent", () => {
    const first = checkoutAttempt(1, items, "Test Road");
    const second = checkoutAttempt(1, [{ id: 1, quantity: 4 }], "Test Road");
    const third = checkoutAttempt(1, [{ id: 1, quantity: 4 }], "Other Road");
    expect(new Set([first.key, second.key, third.key]).size).toBe(3);
    completeCheckoutAttempt(1, first.key);
    expect(readCheckoutAttempt(1)).toEqual(third);
    completeCheckoutAttempt(1, third.key);
    expect(readCheckoutAttempt(1)).toBeNull();
    checkoutAttempt(1, items, null);
    discardCheckoutAttempt(1);
    expect(readCheckoutAttempt(1)).toBeNull();
});

it("fails checkout clearly if its retry key cannot be stored", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage disabled"); });
    expect(() => checkoutAttempt(1, items, null)).toThrow(/enable browser storage/i);
    expect(readCheckoutAttempt(1)).toBeNull();
});
