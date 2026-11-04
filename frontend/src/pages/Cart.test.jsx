import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CartProvider } from "../context/CartContext";
import Cart from "./Cart";

const item = { id: 1, name: "Test Tee", price: 100, quantity: 2 };

function renderCart() {
    return render(<MemoryRouter><CartProvider><Cart /></CartProvider></MemoryRouter>);
}

describe("shopping cart", () => {
    it("shows an empty cart with a link back to the shop", () => {
        renderCart();
        expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /continue shopping/i })).toHaveAttribute("href", "/shop");
    });

    it("updates totals and persists quantities across visits", async () => {
        localStorage.setItem("eben_cart_items", JSON.stringify([item]));
        const user = userEvent.setup();
        const view = renderCart();
        await user.click(screen.getByRole("button", { name: /increase quantity/i }));
        expect(screen.getAllByText("R 300")).toHaveLength(2);
        expect(JSON.parse(localStorage.getItem("eben_cart_items"))[0].quantity).toBe(3);

        view.unmount();
        renderCart();
        expect(screen.getByRole("heading", { name: "Test Tee" })).toBeInTheDocument();
        expect(screen.getAllByText("R 300")).toHaveLength(2);
        await user.click(screen.getByRole("button", { name: /decrease quantity/i }));
        expect(screen.getAllByText("R 200")).toHaveLength(2);
        expect(screen.getByRole("link", { name: /proceed to checkout/i })).toHaveAttribute("href", "/checkout");
    });

    it("removes products from the cart and persistent storage", async () => {
        localStorage.setItem("eben_cart_items", JSON.stringify([item]));
        renderCart();
        await userEvent.setup().click(screen.getByRole("button", { name: /remove item/i }));
        expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
        expect(JSON.parse(localStorage.getItem("eben_cart_items"))).toEqual([]);
    });

    it("recovers from corrupt saved cart data", () => {
        localStorage.setItem("eben_cart_items", "invalid json");
        renderCart();
        expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
    });
});
