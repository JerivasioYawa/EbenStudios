import { useEffect, useState } from "react";
import { DollarSign, ShoppingBag, Users, Package } from "lucide-react";
import { getProducts } from "../../service/productService";
import { getOrders } from "../../service/orderService";
import { formatMoney } from "../../lib/money";

export default function Dashboard() {
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        Promise.all([getProducts(), getOrders()])
            .then(([productsData, ordersData]) => {
                setProducts(productsData);
                setOrders(ordersData);
            })
            .catch((err) => setError(err.response?.data?.message || "Failed to load dashboard data."))
            .finally(() => setLoading(false));
    }, []);

    const revenueCents = orders.reduce((sum, order) => sum + BigInt(order.totalCents), 0n);
    const customerCount = new Set(orders.map((order) => order.userId)).size;

    const stats = [
        { label: "Revenue", value: formatMoney(revenueCents), icon: DollarSign },
        { label: "Orders", value: orders.length, icon: ShoppingBag },
        { label: "Customers", value: customerCount, icon: Users },
        { label: "Products", value: products.length, icon: Package },
    ];

    return (
        <div>
            <h1 className="text-3xl font-black uppercase leading-none mb-8">
                Dashboard
            </h1>

            {error && (
                <p className="text-sm text-red-600 mb-4">{error}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {stats.map(({ label, value, icon: Icon }) => (
                    <div
                        key={label}
                        className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <span className="text-sm text-neutral-500">{label}</span>
                            <Icon size={18} className="text-neutral-400" />
                        </div>

                        <p className="text-2xl font-bold">{loading ? "..." : value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden">
                {loading ? (
                    <p className="p-8 text-center text-neutral-500">Loading recent orders...</p>
                ) : orders.length === 0 ? (
                    <p className="p-8 text-neutral-500">
                        No recent activity yet. Orders will show up here once customers
                        start checking out.
                    </p>
                ) : (
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-black/5 text-sm text-neutral-500">
                                <th className="px-6 py-4 font-medium">Order</th>
                                <th className="px-6 py-4 font-medium">Customer</th>
                                <th className="px-6 py-4 font-medium">Total</th>
                            </tr>
                        </thead>

                        <tbody>
                            {orders.slice(0, 5).map((order) => (
                                <tr key={order.id} className="border-b border-black/5 last:border-0">
                                    <td className="px-6 py-4 font-semibold">#EB-{order.id}</td>
                                    <td className="px-6 py-4 text-neutral-600">{order.customerName}</td>
                                    <td className="px-6 py-4 text-neutral-600">
                                        {formatMoney(order.totalCents)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
