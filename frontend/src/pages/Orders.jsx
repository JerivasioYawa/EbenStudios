import { formatCents } from "../lib/money";
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getMyOrders } from "../service/orderService";

const statusStyles = {
    Paid: "bg-green-100 text-green-700",
    Pending: "bg-yellow-100 text-yellow-700",
    Shipped: "bg-blue-100 text-blue-700",
    Delivered: "bg-purple-100 text-purple-700",
    Cancelled: "bg-red-100 text-red-700",
};

export default function Orders() {
    const { user, loading: authLoading } = useAuth();
    const location = useLocation();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!user) {
            return;
        }

        getMyOrders()
            .then(setOrders)
            .catch((err) => setError(err.response?.data?.message || "Failed to load orders."))
            .finally(() => setLoading(false));
    }, [user]);

    if (authLoading) {
        return null;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
            <p className="uppercase tracking-[0.3em] text-sm text-neutral-500 mb-4">
                Your Orders
            </p>

            <h1 className="text-4xl md:text-5xl font-black uppercase leading-none mb-10">
                Orders
            </h1>

            {location.state?.justOrderedId && (
                <div className="bg-green-50 text-green-700 rounded-2xl px-6 py-4 mb-8 font-semibold">
                    Order #EB-{location.state.justOrderedId} placed successfully!
                </div>
            )}

            {loading && (
                <p className="text-neutral-500">Loading orders...</p>
            )}

            {error && (
                <p className="text-red-600">{error}</p>
            )}

            {!loading && !error && orders.length === 0 && (
                <p className="text-neutral-600 max-w-2xl">
                    You have no orders yet.
                </p>
            )}

            {!loading && !error && orders.length > 0 && (
                <div className="flex flex-col gap-4">
                    {orders.map((order) => (
                        <div
                            key={order.id}
                            className="bg-white rounded-3xl border border-black/5 shadow-sm p-6"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                                <div>
                                    <p className="font-bold text-lg">#EB-{order.id}</p>
                                    <p className="text-sm text-neutral-500">
                                        {new Date(order.createdAt).toLocaleDateString()}
                                    </p>
                                </div>

                                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusStyles[order.status] || "bg-neutral-100 text-neutral-700"}`}>
                                    {order.status}
                                </span>
                            </div>

                            <div className="flex flex-col gap-2 mb-4">
                                {order.items.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between text-sm text-neutral-600">
                                        <span>{item.productName} × {item.quantity}</span>
                                        <span>{formatCents(item.unitPriceCents !== undefined ? item.unitPriceCents * item.quantity : item.priceCents * item.quantity)}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center justify-between border-t border-black/5 pt-4">
                                <span className="text-neutral-500">Total</span>
                                <span className="font-bold">{formatCents(order.totalCents)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
