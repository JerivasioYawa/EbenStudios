import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AuthContext from "../context/auth-context";
import { CartProvider } from "../context/CartContext";
import * as cartService from "../service/cartService";
import Cart from "./Cart";

vi.mock("../service/cartService", () => ({
    getCart: vi.fn(), addCartItem: vi.fn(), setCartQuantity: vi.fn(),
    deleteCartItem: vi.fn(), deleteCart: vi.fn(),
}));

const item = { id: 1, name: "Test Tee", priceCents: 10000, quantity: 2 };

function renderCart() {
    return render(
        <MemoryRouter>
            <AuthContext.Provider value={{ user: { id: 1 }, loading: false }}>
                <CartProvider><Cart /></CartProvider>
            </AuthContext.Provider>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    vi.resetAllMocks();
    localStorage.setItem("eben_auth_token", "test-session");
    cartService.getCart.mockResolvedValue({ items: [] });
});

describe("authenticated shopping cart", () => {
    it("shows an empty saved cart with a link back to the shop", async () => {
        renderCart();
        expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /continue shopping/i })).toHaveAttribute("href", "/shop");
    });

    it("updates totals after saving and reloads persisted quantities on the next visit", async () => {
        cartService.getCart.mockResolvedValueOnce({ items: [item] })
            .mockResolvedValue({ items: [{ ...item, quantity: 3 }] });
        cartService.setCartQuantity.mockResolvedValueOnce({ items: [{ ...item, quantity: 3 }] })
            .mockResolvedValueOnce({ items: [item] });
        const user = userEvent.setup();
        const view = renderCart();
        await user.click(await screen.findByRole("button", { name: /increase quantity/i }));
        await waitFor(() => expect(screen.getAllByText("R 300.00")).toHaveLength(2));
        expect(cartService.setCartQuantity).toHaveBeenCalledWith(1, 3, expect.objectContaining({ sessionToken: "test-session" }));

        view.unmount();
        renderCart();
        await waitFor(() => expect(screen.getAllByText("R 300.00")).toHaveLength(2));
        await user.click(screen.getByRole("button", { name: /decrease quantity/i }));
        await waitFor(() => expect(screen.getAllByText("R 200.00")).toHaveLength(2));
        expect(screen.getByRole("link", { name: /proceed to checkout/i })).toHaveAttribute("href", "/checkout");
    });

    it("removes products through the authenticated API", async () => {
        cartService.getCart.mockResolvedValue({ items: [item] });
        cartService.deleteCartItem.mockResolvedValue({ items: [] });
        renderCart();
        await userEvent.setup().click(await screen.findByRole("button", { name: /remove item/i }));
        expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument();
        expect(cartService.deleteCartItem).toHaveBeenCalledWith(1, expect.objectContaining({ sessionToken: "test-session" }));
    });

    it("ignores a legacy browser cart belonging to no verified account", async () => {
        localStorage.setItem("eben_cart_items", JSON.stringify([item]));
        renderCart();
        expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: item.name })).not.toBeInTheDocument();
    });

    it("shows a load failure instead of claiming an unreachable cart is empty", async () => {
        cartService.getCart.mockRejectedValue(new Error("offline"));
        renderCart();
        expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load your cart/i);
        expect(screen.queryByText(/your cart is empty/i)).not.toBeInTheDocument();
    });
});
