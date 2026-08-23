import { useEffect, useState } from "react";
import { getOrders, updateOrderStatus } from "../../service/orderService";

const ORDER_STATUSES = ["Pending", "Paid", "Shipped", "Delivered", "Cancelled"];

const statusStyles = {
    Paid: "bg-green-100 text-green-700",
    Pending: "bg-yellow-100 text-yellow-700",
    Shipped: "bg-blue-100 text-blue-700",
    Delivered: "bg-purple-100 text-purple-700",
    Cancelled: "bg-red-100 text-red-700",
};

export default function Orders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [updatingId, setUpdatingId] = useState(null);

    useEffect(() => {
        getOrders()
            .then(setOrders)
            .catch((err) => setError(err.response?.data?.message || "Failed to load orders."))
            .finally(() => setLoading(false));
    }, []);

    async function handleStatusChange(orderId, status) {
        setUpdatingId(orderId);
        setError("");

        try {
            const updated = await updateOrderStatus(orderId, status);
            setOrders((current) => current.map((order) => (order.id === orderId ? updated : order)));
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update order status.");
        } finally {
            setUpdatingId(null);
        }
    }

    return (
        <div>
            <h1 className="text-3xl font-black uppercase leading-none mb-8">
                Orders
            </h1>

            {error && (
                <p className="text-sm text-red-600 mb-4">{error}</p>
            )}

            <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-black/5 text-sm text-neutral-500">
                            <th className="px-6 py-4 font-medium">Order</th>
                            <th className="px-6 py-4 font-medium">Customer</th>
                            <th className="px-6 py-4 font-medium">Total</th>
                            <th className="px-6 py-4 font-medium">Status</th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-neutral-500">
                                    Loading orders...
                                </td>
                            </tr>
                        )}

                        {!loading && orders.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-neutral-500">
                                    No orders yet.
                                </td>
                            </tr>
                        )}

                        {!loading && orders.map((order) => (
                            <tr key={order.id} className="border-b border-black/5 last:border-0">
                                <td className="px-6 py-4 font-semibold">#EB-{order.id}</td>
                                <td className="px-6 py-4 text-neutral-600">{order.user?.name}</td>
                                <td className="px-6 py-4 text-neutral-600">
                                    R {Number(order.total).toLocaleString()}
                                </td>
                                <td className="px-6 py-4">
                                    <select
                                        value={order.status}
                                        disabled={updatingId === order.id}
                                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                        className={`text-xs font-semibold pl-3 pr-2 py-1 rounded-full border-0 focus:outline-none disabled:opacity-50 ${statusStyles[order.status] || "bg-neutral-100 text-neutral-700"}`}
                                    >
                                        {ORDER_STATUSES.map((status) => (
                                            <option key={status} value={status}>
                                                {status}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
