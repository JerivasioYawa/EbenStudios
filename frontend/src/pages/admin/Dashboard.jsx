import { useState } from "react";
import { Link } from "react-router-dom";
import { getAudit, getDashboard } from "../../service/adminService";
import { useAdminQuery } from "../../hooks/useAdminQuery";
import { actionClass, Pagination, QueryState } from "../../components/admin/ManagementControls";
import { formatMoney } from "../../lib/money";

export default function Dashboard() {
    const [revision, setRevision] = useState(0), [auditPage, setAuditPage] = useState(1);
    const result = useAdminQuery(getDashboard, {}, revision), audit = useAdminQuery(getAudit, { page: auditPage, pageSize: 10 }, revision);
    const data = result.data;
    const stats = data ? [
        ["Confirmed payments", formatMoney(data.confirmedPaymentsCents)],
        ["Cancelled payments awaiting refund", formatMoney(data.awaitingRefundCents)],
        ["Recorded refunds", formatMoney(data.refundedCents)],
        ["Pending payment orders", data.pendingOrders], ["Unverified legacy payments", data.unverifiedOrders],
        ["Orders", data.orders], ["Customers", data.customers], ["Active products", data.products], ["Archived products", data.archivedProducts],
    ] : [];
    return <div>
        <div className="flex justify-between mb-8"><h1 className="text-3xl font-black uppercase">Dashboard</h1><button className={actionClass} onClick={() => setRevision(current => current + 1)}>Refresh</button></div>
        <QueryState {...result} retry={() => setRevision(revision + 1)} />
        {data && <>
            <p className="text-sm text-neutral-600 mb-6">Confirmed payments include verified payment records for orders that have not been cancelled. Pending and cancelled orders are excluded; refunds are shown separately.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">{stats.map(([label, value]) => <div key={label} className="bg-white p-6 border rounded-3xl"><h2 className="text-neutral-500">{label}</h2><p className="text-2xl font-bold mt-4">{value}</p></div>)}</div>
            <section className="bg-white p-6 border rounded-3xl mb-8"><h2 className="text-xl font-bold mb-4">Recent orders</h2>
                {data.recentOrders.length === 0 && <p>No recent orders.</p>}
                <ul>{data.recentOrders.map(order => <li key={order.id} className="py-3 border-b"><Link className="underline font-semibold" to={`/admin/orders?order=${order.id}`}>#EB-{order.id}</Link> · {order.customerName} · {formatMoney(order.totalCents)} · {order.paymentStatus} / {order.fulfilmentStatus}</li>)}</ul>
            </section>
            <section className="bg-white p-6 border rounded-3xl mb-8"><h2 className="text-xl font-bold mb-4">Low stock</h2>
                {data.lowStock.length === 0 ? <p>No active products are below their stock threshold.</p> : <ul>{data.lowStock.map(product => <li key={product.id}>{product.name}: {product.stock} remaining (threshold {product.lowStockThreshold})</li>)}</ul>}
                <Link className="block underline mt-4" to="/admin/products">Manage products</Link>
            </section>
        </>}
        <section className="bg-white p-6 border rounded-3xl"><h2 className="text-xl font-bold mb-4">Admin activity</h2>
            <QueryState {...audit} retry={() => setRevision(revision + 1)} />
            {audit.data && <><ul>{audit.data.items.map(row => <li key={row.id} className="py-3 border-b">{row.action} · {row.entityType} #{row.entityId}{row.reason ? " · " + row.reason : ""}<br /><span className="text-sm text-neutral-500">{row.actorName} · {new Date(row.createdAt).toLocaleString()}</span></li>)}</ul><Pagination {...audit.data} onChange={setAuditPage} /></>}
        </section>
    </div>;
}
