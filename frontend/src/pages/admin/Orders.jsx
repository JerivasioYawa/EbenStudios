import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { cancelOrder, changeFulfilment, confirmPayment, getAdminOrder, getAdminOrders, recordRefund, updateShipping } from "../../service/adminService";
import { useAdminQuery } from "../../hooks/useAdminQuery";
import { actionClass, fieldClass, Pagination, QueryState } from "../../components/admin/ManagementControls";
import { formatMoney } from "../../lib/money";

function OrderControls({ order, pending, mutate }) {
    const [reference, setReference] = useState(""), [refundReference, setRefundReference] = useState("");
    const [shipping, setShipping] = useState(order.shippingReference || ""), [reason, setReason] = useState("");
    const cancelled = order.fulfilmentStatus === "Cancelled";
    function submit(event, method, data) { event.preventDefault(); mutate(method, data); }
    return <fieldset disabled={pending} className="grid lg:grid-cols-2 gap-6 mt-6">
        {!cancelled && ["Pending", "Unverified"].includes(order.paymentStatus) && <form aria-label="Payment confirmation" onSubmit={event => submit(event, confirmPayment, { reference, amountCents: order.totalCents })} className="border rounded-2xl p-4">
            <h3 className="font-bold">Confirm payment</h3><p className="text-sm my-2">Record a verified full payment of {formatMoney(order.totalCents)}.</p>
            <label>Payment reference<input className={fieldClass} required maxLength={200} value={reference} onChange={event => setReference(event.target.value)} /></label>
            <button className={actionClass + " mt-3"} disabled={pending}>Confirm Payment</button>
        </form>}
        {order.paymentStatus === "RefundRequired" && <form aria-label="Refund record" onSubmit={event => submit(event, recordRefund, { reference: refundReference, amountCents: order.totalCents })} className="border rounded-2xl p-4">
            <h3 className="font-bold">Refund required: {formatMoney(order.totalCents)}</h3><p className="text-sm my-2">Record the reference after the refund has been processed.</p>
            <label>Refund reference<input className={fieldClass} required maxLength={200} value={refundReference} onChange={event => setRefundReference(event.target.value)} /></label>
            <button className={actionClass + " mt-3"} disabled={pending}>Record Refund</button>
        </form>}
        {order.paymentStatus === "Confirmed" && order.fulfilmentStatus === "Unfulfilled" && <button className={actionClass} disabled={pending} onClick={() => mutate(changeFulfilment, { fulfilmentStatus: "Processing" })}>Start Processing</button>}
        {order.paymentStatus === "Confirmed" && ["Processing", "Shipped"].includes(order.fulfilmentStatus) && <form aria-label="Shipping details" onSubmit={event => submit(event, order.fulfilmentStatus === "Processing" ? changeFulfilment : updateShipping,
            order.fulfilmentStatus === "Processing" ? { fulfilmentStatus: "Shipped", shippingReference: shipping } : { shippingReference: shipping, reason })} className="border rounded-2xl p-4">
            <label>Shipping reference<input className={fieldClass} required maxLength={200} value={shipping} onChange={event => setShipping(event.target.value)} /></label>
            {order.fulfilmentStatus === "Shipped" && <label>Shipping change reason<input className={fieldClass} required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label>}
            <button className={actionClass + " mt-3"} disabled={pending}>{order.fulfilmentStatus === "Processing" ? "Mark Shipped" : "Update Shipping"}</button>
        </form>}
        {order.fulfilmentStatus === "Shipped" && <button className={actionClass} disabled={pending} onClick={() => mutate(changeFulfilment, { fulfilmentStatus: "Delivered" })}>Mark Delivered</button>}
        {["Unfulfilled", "Processing"].includes(order.fulfilmentStatus) && <form aria-label="Order cancellation" onSubmit={event => submit(event, cancelOrder, { reason })} className="border rounded-2xl p-4">
            <label>Cancellation reason<textarea className={fieldClass} required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label>
            <p className="text-sm my-2">Cancellation restores stock once. Confirmed payments will require a refund record.</p>
            <button className={actionClass} disabled={pending}>Cancel Order</button>
        </form>}
    </fieldset>;
}

function OrderDetails({ id, close, changed }) {
    const [revision, setRevision] = useState(0), [pending, setPending] = useState(false), [error, setError] = useState("");
    const result = useAdminQuery(getAdminOrder, { id }, revision), order = result.data;
    async function mutate(method, data) {
        setPending(true); setError("");
        try { await method(id, data); setRevision(current => current + 1); changed(); }
        catch (failure) { setError(failure.response?.data?.message || "Unable to update this order."); }
        finally { setPending(false); }
    }
    return <section aria-label="Order details" className="mt-8 p-6 bg-white border rounded-3xl">
        <div className="flex justify-between"><h2 className="text-2xl font-bold">Order #EB-{id}</h2><button className={actionClass} onClick={close}>Close details</button></div>
        <QueryState {...result} retry={() => setRevision(revision + 1)} />
        {error && <p role="alert" className="text-red-700 py-3">{error}</p>}
        {order && <>
            <div className="grid sm:grid-cols-2 gap-5 my-6"><div><h3 className="font-bold">Customer</h3><p>{order.customerName}</p><p>{order.customerEmail}</p></div><div><h3 className="font-bold">Shipping address</h3><p>{order.shippingAddress || "Not supplied"}</p><p>Shipping reference: {order.shippingReference || "Not supplied"}</p></div></div>
            <p>Payment: <strong>{order.paymentStatus}</strong> · Fulfilment: <strong>{order.fulfilmentStatus}</strong></p>
            <h3 className="font-bold mt-6">Items</h3>
            <ul>{order.items.map(item => <li className="flex justify-between py-2 border-b gap-4" key={item.id}><span>{item.productName} × {item.quantity} at {formatMoney(item.unitPriceCents)}</span><strong>{formatMoney(item.lineTotalCents)}</strong></li>)}</ul>
            {order.adjustmentCents !== 0 && <p>Historical adjustment: {formatMoney(order.adjustmentCents)}</p>}
            <p className="text-lg font-bold my-3">Total: {formatMoney(order.totalCents)}</p>
            <OrderControls key={order.paymentStatus + order.fulfilmentStatus} order={order} pending={pending} mutate={mutate} />
            <h3 className="font-bold mt-8 mb-3">Payment records</h3>
            {order.payments.length === 0 && <p>No confirmed payment records.</p>}
            <ul>{order.payments.map(payment => <li key={payment.id} className="py-2 border-b">{payment.kind}: {formatMoney(payment.amountCents)} · {payment.reference}<br /><span className="text-sm text-neutral-500">{payment.actorName} · {new Date(payment.createdAt).toLocaleString()}</span></li>)}</ul>
            <h3 className="font-bold mt-8 mb-3">Order history</h3>
            <ol>{order.history.map(event => <li key={event.id} className="py-2 border-b">{event.type}{event.toStatus ? ": " + event.toStatus : ""}{event.note ? " · " + event.note : ""}<br /><span className="text-sm text-neutral-500">{event.actorName} · {new Date(event.createdAt).toLocaleString()}</span></li>)}</ol>
        </>}
    </section>;
}

export default function Orders() {
    const [searchParams] = useSearchParams();
    const [selectedId, setSelectedId] = useState(() => /^\d+$/.test(searchParams.get("order") || "") ? Number(searchParams.get("order")) : null);
    const [filters, setFilters] = useState({ q: "", paymentStatus: "", fulfilmentStatus: "", page: 1, pageSize: 10 });
    const [revision, setRevision] = useState(0);
    const result = useAdminQuery(getAdminOrders, filters, revision);
    const filter = event => setFilters(current => ({ ...current, [event.target.name]: event.target.value, page: 1 }));
    return <div>
        <h1 className="text-3xl font-black uppercase mb-8">Orders</h1>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <label>Search orders<input className={fieldClass} name="q" value={filters.q} maxLength={120} onChange={filter} /></label>
            <label>Payment filter<select className={fieldClass} name="paymentStatus" value={filters.paymentStatus} onChange={filter}><option value="">All payments</option>{["Pending", "Unverified", "Confirmed", "RefundRequired", "Refunded"].map(status => <option key={status}>{status}</option>)}</select></label>
            <label>Fulfilment filter<select className={fieldClass} name="fulfilmentStatus" value={filters.fulfilmentStatus} onChange={filter}><option value="">All fulfilment</option>{["Unfulfilled", "Processing", "Shipped", "Delivered", "Cancelled"].map(status => <option key={status}>{status}</option>)}</select></label>
            <label>Orders per page<select className={fieldClass} name="pageSize" value={filters.pageSize} onChange={filter}>{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
        </div>
        <QueryState {...result} retry={() => setRevision(revision + 1)} />
        {result.data && <>
            <div className="overflow-x-auto bg-white border rounded-3xl"><table className="w-full text-left"><thead><tr>{["Order", "Customer", "Total", "Payment", "Fulfilment", "Details"].map(title => <th className="p-4" key={title}>{title}</th>)}</tr></thead><tbody>
                {result.data.items.map(order => <tr key={order.id} className="border-t"><td className="p-4 font-bold">#EB-{order.id}</td><td className="p-4">{order.customerName}<span className="block text-sm text-neutral-500">{order.customerEmail}</span></td><td className="p-4">{formatMoney(order.totalCents)}</td><td className="p-4">{order.paymentStatus}</td><td className="p-4">{order.fulfilmentStatus}</td><td className="p-4"><button className={actionClass} onClick={() => setSelectedId(order.id)}>View Details</button></td></tr>)}
            </tbody></table>{result.data.total === 0 && <p className="p-6">No matching orders.</p>}</div>
            <Pagination {...result.data} onChange={page => setFilters(current => ({ ...current, page }))} />
        </>}
        {selectedId && <OrderDetails key={selectedId} id={selectedId} close={() => setSelectedId(null)} changed={() => setRevision(current => current + 1)} />}
    </div>;
}
