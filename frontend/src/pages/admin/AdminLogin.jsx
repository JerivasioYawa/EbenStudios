import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function AdminLogin() {
    const { user, loading, login, logout } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    if (!loading && user?.role === "ADMIN") {
        return <Navigate to="/admin" replace />;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setSubmitting(true);

        try {
            const loggedInUser = await login(email, password);

            if (loggedInUser.role === "ADMIN") {
                navigate("/admin");
            } else {
                logout();
                setError("This account does not have admin access.");
            }
        } catch (err) {
            setError(err.response?.data?.message || "Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white px-6">
            <div className="w-full max-w-md">
                <p className="uppercase tracking-[0.3em] text-sm text-neutral-400 mb-4 text-center">
                    Eben Studios
                </p>

                <h1 className="text-4xl font-black uppercase leading-none mb-8 text-center">
                    Admin Login
                </h1>

                {error && (
                    <p className="text-center text-sm text-red-400 mb-4">
                        {error}
                    </p>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <input
                        type="email"
                        required
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="rounded-full px-6 py-4 bg-white/10 border border-white/20 placeholder:text-neutral-400 focus:outline-none"
                    />

                    <input
                        type="password"
                        required
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="rounded-full px-6 py-4 bg-white/10 border border-white/20 placeholder:text-neutral-400 focus:outline-none"
                    />

                    <button
                        type="submit"
                        disabled={submitting}
                        className="bg-white text-black rounded-full px-6 py-4 font-semibold hover:bg-neutral-200 transition disabled:opacity-50"
                    >
                        {submitting ? "Logging In..." : "Log In"}
                    </button>
                </form>
            </div>
        </div>
    );
}
