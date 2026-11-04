import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getInvoiceConfig, getInvoices, issueInvoice } from "../../service/invoiceService";
import { useAdminQuery } from "../../hooks/useAdminQuery";
import { actionClass, QueryState } from "../admin/ManagementControls";
import InvoiceForm from "./InvoiceForm";

function Issuance({ order, close }) {
    const [revision, setRevision] = useState(0), navigate = useNavigate();
    const config = useAdminQuery(getInvoiceConfig, {}, revision);
    return <><QueryState {...config} retry={() => setRevision(revision + 1)} />{config.data && <InvoiceForm
        initial={{ seller: config.data.seller, billing: { name: order.customerName, email: order.customerEmail, address: order.shippingAddress || "" } }}
        close={close} onSave={async body => { const invoice = await issueInvoice(order.id, body); navigate(`/admin/invoices?invoice=${invoice.id}`); }} />}</>;
}
export default function OrderInvoices({ order }) {
    const [prepare, setPrepare] = useState(false), [revision, setRevision] = useState(0);
    const result = useAdminQuery(getInvoices, { orderId: order.id, pageSize: 10 }, revision);
    return <section aria-label="Order invoices" className="border-t mt-8 pt-6">
        <h3 className="font-bold text-xl mb-3">Invoices</h3>
        <QueryState {...result} retry={() => setRevision(revision + 1)} />
        {result.data && <>
            <ul>{result.data.items.map(invoice => <li key={invoice.id} className="py-2"><Link className="font-semibold underline" to={`/admin/invoices?invoice=${invoice.id}`}>{invoice.number}</Link> · {invoice.status} · Revision {invoice.revision}</li>)}</ul>
            {result.data.total === 0 && (order.fulfilmentStatus === "Cancelled" ? <p>Cancelled orders cannot be invoiced.</p> : <>
                <p className="mb-3">No invoice has been issued for this order.</p>
                {!prepare && <button className={actionClass} onClick={() => setPrepare(true)}>Prepare Invoice</button>}
                {prepare && <Issuance order={order} close={() => setPrepare(false)} />}
            </>)}
            {result.data.total > 0 && <Link className="block mt-3 underline" to={`/admin/invoices?orderId=${order.id}`}>View all order invoices</Link>}
        </>}
    </section>;
}
