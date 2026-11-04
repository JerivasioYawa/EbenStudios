import { beforeEach, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import AuthContext from "./auth-context";
import { CartProvider } from "./CartContext";
import { useCart } from "../hooks/useCart";
import * as cartService from "../service/cartService";
import { createOrder } from "../service/orderService";
import { readCheckoutAttempt } from "../service/checkoutAttempt";

vi.mock("../service/cartService", () => ({
    getCart: vi.fn(), addCartItem: vi.fn(), setCartQuantity: vi.fn(), deleteCartItem: vi.fn(), deleteCart: vi.fn(),
}));
vi.mock("../service/orderService", () => ({ createOrder: vi.fn() }));

beforeEach(() => {
    vi.resetAllMocks();
    localStorage.setItem("eben_auth_token", "session-a");
    cartService.getCart.mockResolvedValue({ items: [] });
});

function harness(initialAuth) {
    let auth = initialAuth;
    const wrapper = ({ children }) => <AuthContext.Provider value={auth}><CartProvider>{children}</CartProvider></AuthContext.Provider>;
    const view = renderHook(() => useCart(), { wrapper });
    return { ...view, setAuth(next) { auth = next; view.rerender(); } };
}

it.each([
    { user: null, loading: false },
    { user: { id: 1 }, loading: true },
])("rejects every cart mutation without verified authentication (%j)", async (auth) => {
    const { result } = harness(auth);
    for (const action of [
        () => result.current.addToCart({ id: 1 }), () => result.current.updateQuantity(1, 2),
        () => result.current.removeFromCart(1), () => result.current.clearCart(), () => result.current.checkout("address"),
    ]) await expect(action()).rejects.toThrow(/log in/i);
    expect(result.current.items).toEqual([]);
    for (const method of Object.values(cartService)) expect(method).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
});

it("clears active state on logout, loads the next account, and ignores a previous account's late response", async () => {
    let resolveFirst;
    cartService.getCart.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
        .mockResolvedValueOnce({ items: [{ id: 2, name: "B Tee", priceCents: 2000, quantity: 1 }] })
        .mockResolvedValueOnce({ items: [{ id: 1, name: "A Hoodie", priceCents: 5000, quantity: 2 }] });
    const view = harness({ user: { id: 1 }, loading: false });
    await waitFor(() => expect(cartService.getCart).toHaveBeenCalledTimes(1));
    localStorage.setItem("eben_auth_token", "session-b");
    view.setAuth({ user: { id: 2 }, loading: false });
    await waitFor(() => expect(view.result.current.items[0]?.name).toBe("B Tee"));
    await act(async () => { resolveFirst({ items: [{ id: 1, name: "A Hoodie", priceCents: 5000, quantity: 2 }] }); });
    expect(view.result.current.items[0].name).toBe("B Tee");
    localStorage.removeItem("eben_auth_token");
    view.setAuth({ user: null, loading: false });
    expect(view.result.current.items).toEqual([]);
    expect(view.result.current.itemCount).toBe(0);
    expect(cartService.deleteCart).not.toHaveBeenCalled();
    localStorage.setItem("eben_auth_token", "session-a");
    view.setAuth({ user: { id: 1 }, loading: false });
    await waitFor(() => expect(view.result.current.items[0]?.name).toBe("A Hoodie"));
});

it("ignores an in-flight mutation when the customer switches accounts", async () => {
    let resolveMutation;
    cartService.addCartItem.mockImplementation(() => new Promise((resolve) => { resolveMutation = resolve; }));
    const view = harness({ user: { id: 1 }, loading: false });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    let outcome;
    act(() => { outcome = view.result.current.addToCart({ id: 1 }).catch((error) => error); });
    localStorage.setItem("eben_auth_token", "session-b");
    view.setAuth({ user: { id: 2 }, loading: false });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    await act(async () => { resolveMutation({ items: [{ id: 1, priceCents: 5000, quantity: 1 }] }); });
    expect((await outcome).message).toMatch(/account changed/i);
    expect(view.result.current.items).toEqual([]);
});

it("keeps the cart and checkout key after a lost response and clears them only after acknowledgement", async () => {
    const item = { id: 1, priceCents: 29, quantity: 3 };
    cartService.getCart.mockResolvedValue({ items: [item] });
    createOrder.mockRejectedValueOnce(new Error("Connection lost"))
        .mockResolvedValueOnce({ id: 7, totalCents: 87 });
    const { result } = harness({ user: { id: 1 }, loading: false });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.subtotalCents).toBe(87n);
    await act(async () => { await expect(result.current.checkout("Test Road")).rejects.toThrow("Connection lost"); });
    expect(result.current.items).toEqual([item]);
    expect(result.current.pendingCheckout).toBe(true);
    const first = createOrder.mock.calls[0][0];
    expect(readCheckoutAttempt(1).key).toBe(first.idempotencyKey);
    await act(async () => { expect(await result.current.checkout("Test Road")).toEqual({ id: 7, totalCents: 87 }); });
    expect(createOrder.mock.calls[1][0]).toEqual(first);
    expect(result.current.items).toEqual([]);
    expect(readCheckoutAttempt(1)).toBeNull();
});

it("starts a new checkout intent after a successful cart change", async () => {
    const item = { id: 1, priceCents: 29, quantity: 3 };
    cartService.getCart.mockResolvedValue({ items: [item] });
    cartService.setCartQuantity.mockResolvedValue({ items: [{ ...item, quantity: 2 }] });
    createOrder.mockRejectedValue(new Error("offline"));
    const { result } = harness({ user: { id: 1 }, loading: false });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await expect(result.current.checkout("Test Road")).rejects.toThrow(); });
    const first = readCheckoutAttempt(1).key;
    await act(async () => { await result.current.updateQuantity(1, 2); });
    expect(readCheckoutAttempt(1)).toBeNull();
    await act(async () => { await expect(result.current.checkout("Test Road")).rejects.toThrow(); });
    expect(readCheckoutAttempt(1).key).not.toBe(first);
});
