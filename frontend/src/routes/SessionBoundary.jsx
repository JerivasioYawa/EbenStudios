import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { returnTo } from "../lib/loginReturn";

export default function SessionBoundary({ children }) {
    const { user, loading, sessionError } = useAuth();
    const location = useLocation();
    if (sessionError && !user && !loading && location.pathname !== "/login") {
        return <Navigate to="/login" replace state={{ from: returnTo(location), message: sessionError }} />;
    }
    return children;
}
