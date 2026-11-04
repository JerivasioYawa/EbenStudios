import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AuthContext from "../context/auth-context";
import ProtectedRoute from "./ProtectedRoute";

function LoginDestination() {
    const location = useLocation();
    return <><h1>Log in</h1><p>{location.state?.from}</p></>;
}

function renderRoute(path, user = null, loading = false) {
    return render(<AuthContext.Provider value={{ user, loading }}>
        <MemoryRouter initialEntries={[path]}><Routes>
            <Route element={<ProtectedRoute />}>
                <Route path="/cart" element={<h1>Saved cart</h1>} />
                <Route path="/checkout" element={<h1>Checkout</h1>} />
            </Route>
            <Route path="/login" element={<LoginDestination />} />
        </Routes></MemoryRouter>
    </AuthContext.Provider>);
}

it.each(["/cart?source=shop#bag", "/checkout"])("redirects guests and preserves the destination %s", (path) => {
    renderRoute(path);
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByText(path, { exact: true })).toBeInTheDocument();
});

it("waits for authentication before exposing the cart", () => {
    renderRoute("/cart", null, true);
    expect(screen.getByRole("status")).toHaveTextContent(/checking your session/i);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});

it("allows an authenticated customer to open their cart", () => {
    renderRoute("/cart", { id: 1, role: "CUSTOMER" });
    expect(screen.getByRole("heading", { name: "Saved cart" })).toBeInTheDocument();
});
