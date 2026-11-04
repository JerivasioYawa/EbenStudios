import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AuthContext from "../../context/auth-context";
import { LikesProvider } from "../../context/LikesContext";
import { readGuestLikes } from "../../service/guestLikes";
import ProductCard from "./ProductCard";

function renderCard(loading = false) {
    return render(<MemoryRouter initialEntries={["/shop"]}>
        <AuthContext.Provider value={{ user: null, loading }}><LikesProvider><Routes>
            <Route path="/shop" element={<><h1>Shop</h1><ProductCard product={{ id: 1, name: "Test Tee", priceCents: 10000 }} /></>} />
            <Route path="/products/1" element={<h1>Product details</h1>} />
        </Routes></LikesProvider></AuthContext.Provider>
    </MemoryRouter>);
}

it("keeps the native heart button outside the navigation link and supports mouse, Enter, and Space", async () => {
    renderCard();
    const user = userEvent.setup();
    const heart = screen.getByRole("button", { name: "Like Test Tee", exact: true });
    expect(heart.closest("a")).toBeNull();
    expect(heart).toHaveAttribute("type", "button");
    expect(heart).toHaveAttribute("aria-pressed", "false");
    await user.click(heart);
    expect(heart).toHaveAttribute("aria-pressed", "true");
    await user.keyboard("{Enter}");
    expect(heart).toHaveAttribute("aria-pressed", "false");
    await user.keyboard(" ");
    expect(heart).toHaveAttribute("aria-pressed", "true");
    expect(readGuestLikes()).toEqual([1]);
    expect(screen.getByRole("heading", { name: "Shop" })).toBeInTheDocument();
    await user.click(screen.getByRole("heading", { name: "Test Tee" }));
    expect(screen.getByRole("heading", { name: "Product details" })).toBeInTheDocument();
});

it("announces a storage failure and does not display an unsaved like", async () => {
    renderCard();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    const heart = screen.getByRole("button", { name: "Like Test Tee", exact: true });
    await userEvent.setup().click(heart);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save your likes on this device.");
    expect(heart).toHaveAttribute("aria-pressed", "false");
});

it("disables the heart until authentication has finished loading", () => {
    renderCard(true);
    expect(screen.getByRole("button", { name: "Like Test Tee", exact: true })).toBeDisabled();
});
