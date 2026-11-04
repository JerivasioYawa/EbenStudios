import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Profile() {
    const { user, loading, logout } = useAuth();

    if (loading) {
        return null;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
            <p className="uppercase tracking-[0.3em] text-sm text-neutral-500 mb-4">
                Account
            </p>

            <h1 className="text-4xl md:text-5xl font-black uppercase leading-none mb-6">
                Profile
            </h1>

            <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm max-w-md">
                <p className="text-sm text-neutral-500 mb-1">Name</p>
                <p className="font-semibold mb-4">{user.name}</p>

                <p className="text-sm text-neutral-500 mb-1">Email</p>
                <p className="font-semibold mb-6">{user.email}</p>
                <Link className="block underline mb-6" to="/invoices">Your invoices</Link>

                <button
                    onClick={logout}
                    className="text-sm font-semibold text-red-600 hover:text-red-700 transition"
                >
                    Log Out
                </button>
            </div>
        </section>
    );
}
