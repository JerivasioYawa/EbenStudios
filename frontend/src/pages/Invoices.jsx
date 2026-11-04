import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getInvoices, getMyInvoices } from "../service/invoiceService";
import { useAdminQuery } from "../hooks/useAdminQuery";
import { actionClass, fieldClass, Pagination, QueryState } from "../components/admin/ManagementControls";
import InvoiceDetails from "../components/invoices/InvoiceDetails";
import { formatMoney } from "../lib/money";

export default function Invoices({ admin = false }) {
    const params = useParams(), [search] = useSearchParams();
    const selectedId = params.id || search.get("invoice");
    const [filters, setFilters] = useState({ q: "", status: "", page: 1, pageSize: 10 });
    const [revision, setRevision] = useState(0);
    const result = useAdminQuery(admin ? getInvoices : getMyInvoices, { ...filters, orderId: search.get("orderId") || "" }, revision);
    const change = event => setFilters(current => ({ ...current, [event.target.name]: event.target.value, page: 1 }));
    return <div className={admin ? "" : "max-w-7xl mx-auto px-6 lg:px-10 py-16"}>
        <h1 className="text-3xl font-black uppercase mb-6">{admin ? "Invoices" : "Your Invoices"}</h1>
        {admin && <p className="mb-5">Issue invoices from an order's details. Corrections retain the original invoice and create a linked replacement.</p>}
        {search.get("orderId") && <p className="mb-4">Invoices for order #EB-{search.get("orderId")}</p>}
        <div className="grid sm:grid-cols-3 gap-3 mb-5">
            <label>Search invoices<input className={fieldClass} name="q" maxLength={120} value={filters.q} onChange={change} /></label>
            <label>Invoice status<select className={fieldClass} name="status" value={filters.status} onChange={change}><option value="">All statuses</option><option>Issued</option><option>Voided</option></select></label>
            <label>Invoices per page<select className={fieldClass} name="pageSize" value={filters.pageSize} onChange={change}>{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
        </div>
        <QueryState {...result} retry={() => setRevision(revision + 1)} />
        {result.data && <>
            <div className="overflow-x-auto border rounded-3xl bg-white"><table className="w-full text-left"><thead><tr>{["Invoice", "Order", "Bill to", "Status", "Total", "Details"].map(title => <th className="p-4" key={title}>{title}</th>)}</tr></thead><tbody>
                {result.data.items.map(invoice => <tr key={invoice.id} className="border-t"><td className="p-4 font-semibold">{invoice.number}</td><td className="p-4">{invoice.orderNumber}</td><td className="p-4">{invoice.billing.name}</td><td className="p-4">{invoice.status}</td><td className="p-4 whitespace-nowrap">{formatMoney(invoice.totalCents)}</td><td className="p-4"><Link className={actionClass} to={admin ? `/admin/invoices?invoice=${invoice.id}` : `/invoices/${invoice.id}`}>View Invoice</Link></td></tr>)}
            </tbody></table>{result.data.total === 0 && <p className="p-6">No invoices have been issued for these filters.</p>}</div>
            <Pagination {...result.data} onChange={page => setFilters(current => ({ ...current, page }))} />
        </>}
        {selectedId && <InvoiceDetails key={selectedId} id={selectedId} admin={admin} changed={() => setRevision(current => current + 1)} />}
    </div>;
}
