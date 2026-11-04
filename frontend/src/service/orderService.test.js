import { expect, it, vi } from "vitest";
import api from "./api";
import { createOrder } from "./orderService";

vi.mock("./api", () => ({ default: { post: vi.fn() } }));

it("sends the retry key as a header and preserves the authenticated request configuration", async () => {
    api.post.mockResolvedValue({ data: { id: 1, totalCents: 87 } });
    const key = crypto.randomUUID();
    expect(await createOrder({ shippingAddress: "Test Road", idempotencyKey: key }, {
        sessionToken: "session-a", headers: { "X-Request-Source": "checkout" },
    })).toEqual({ id: 1, totalCents: 87 });
    expect(api.post).toHaveBeenCalledWith("/orders", { shippingAddress: "Test Road" }, {
        sessionToken: "session-a", headers: { "X-Request-Source": "checkout", "Idempotency-Key": key },
    });
});
