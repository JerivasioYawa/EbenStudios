import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { returnTo } from "../lib/loginReturn";

export default function ProtectedRoute() {
    const { user, loading } = useAuth();
    const location = useLocation();
    if (loading) return <p role="status">Checking your session...</p>;
    if (!user) return <Navigate to="/login" replace state={{ from: returnTo(location) }} />;
    return <Outlet />;
}
