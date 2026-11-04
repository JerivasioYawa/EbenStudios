import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AuthContext from "../context/auth-context";
import AdminRoute from "./AdminRoute";

function renderRoute(user, loading = false) {
    return render(
        <AuthContext.Provider value={{ user, loading }}>
            <MemoryRouter initialEntries={["/admin"]}>
                <Routes>
                    <Route path="/admin" element={<AdminRoute><h1>Admin dashboard</h1></AdminRoute>} />
                    <Route path="/admin/login" element={<h1>Admin login</h1>} />
                </Routes>
            </MemoryRouter>
        </AuthContext.Provider>,
    );
}

describe("admin route", () => {
    it.each([null, { role: "CUSTOMER" }])("redirects a non-admin user (%j) to admin login", (user) => {
        renderRoute(user);
        expect(screen.getByRole("heading", { name: "Admin login" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Admin dashboard" })).not.toBeInTheDocument();
    });

    it("allows an authenticated admin", () => {
        renderRoute({ role: "ADMIN" });
        expect(screen.getByRole("heading", { name: "Admin dashboard" })).toBeInTheDocument();
    });

    it("waits for authentication before showing protected content or redirecting", () => {
        renderRoute(null, true);
        expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    });
});
