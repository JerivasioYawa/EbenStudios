import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setSubmitting(true);

        try {
            await register(name, email, password);
            navigate("/");
        } catch (err) {
            setError(err.response?.data?.message || "Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="max-w-md mx-auto px-6 py-20">
            <p className="uppercase tracking-[0.3em] text-sm text-neutral-500 mb-4 text-center">
                Join Eben Studios
            </p>

            <h1 className="text-4xl font-black uppercase leading-none mb-8 text-center">
                Register
            </h1>

            {error && (
                <p role="alert" className="text-center text-sm text-red-600 mb-4">
                    {error}
                </p>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label htmlFor="account-text">Full name</label>
                <input id="account-text"
                    type="text"
                    required
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-full px-6 py-4 border border-black/10 bg-white focus:outline-none"
                />

                <label htmlFor="account-email">Email</label>
                <input id="account-email"
                    type="email"
                    required
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-full px-6 py-4 border border-black/10 bg-white focus:outline-none"
                />

                <label htmlFor="account-password">Password (at least 12 characters)</label>
                <input id="account-password"
                    type="password"
                    required minLength={12} autoComplete="new-password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-full px-6 py-4 border border-black/10 bg-white focus:outline-none"
                />

                <button
                    type="submit"
                    disabled={submitting}
                    className="bg-black text-white rounded-full px-6 py-4 font-semibold hover:bg-neutral-800 transition disabled:opacity-50"
                >
                    {submitting ? "Creating Account..." : "Create Account"}
                </button>
            </form>

            <p className="text-center text-sm text-neutral-500 mt-6">
                Already have an account?{" "}
                <Link to="/login" className="text-black font-semibold">
                    Log in
                </Link>
            </p>
        </section>
    );
}
