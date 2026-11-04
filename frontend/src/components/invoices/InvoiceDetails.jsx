import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { correctInvoice, downloadInvoice, getInvoice, voidInvoice } from "../../service/invoiceService";
import { useAdminQuery } from "../../hooks/useAdminQuery";
import { actionClass, fieldClass, QueryState } from "../admin/ManagementControls";
import { formatMoney } from "../../lib/money";
import InvoiceForm from "./InvoiceForm";

export default function InvoiceDetails({ id, admin = false, changed }) {
    const [revision, setRevision] = useState(0), [pending, setPending] = useState(false), [error, setError] = useState("");
    const [correction, setCorrection] = useState(false), [voiding, setVoiding] = useState(false), [reason, setReason] = useState("");
    const result = useAdminQuery(getInvoice, { id }, revision), invoice = result.data, navigate = useNavigate();
    const path = invoiceId => admin ? `/admin/invoices?invoice=${invoiceId}` : `/invoices/${invoiceId}`;
    async function download() {
        setPending(true); setError("");
        try { await downloadInvoice(id); }
        catch (failure) { setError(failure.message || "Unable to download this invoice."); }
        finally { setPending(false); }
    }
    async function submitVoid(event) {
        event.preventDefault(); setPending(true); setError("");
        try { await voidInvoice(id, { reason }); setVoiding(false); setRevision(current => current + 1); changed?.(); }
        catch (failure) { setError(failure.response?.data?.message || "Unable to void this invoice."); }
        finally { setPending(false); }
    }
    function party(value, title) {
        return <div><h3 className="font-bold mb-2">{title}</h3><p className="font-semibold">{value.name}</p><p className="whitespace-pre-wrap">{value.address}</p><p>{value.email}</p>
            {value.phone && <p>{value.phone}</p>}{value.registrationNumber && <p>Registration: {value.registrationNumber}</p>}{value.taxNumber && <p>Tax registration: {value.taxNumber}</p>}</div>;
    }
    return <section aria-label="Invoice details" className="mt-8 bg-white border rounded-3xl p-6">
        <QueryState {...result} retry={() => setRevision(revision + 1)} />
        {error && <p role="alert" className="text-red-700 mb-4">{error}</p>}
        {invoice && <>
            <div className="flex flex-wrap justify-between items-center gap-4"><h2 className="font-bold text-2xl">{invoice.number}</h2><strong className={invoice.status === "Voided" ? "text-red-700" : "text-green-800"}>{invoice.status}</strong></div>
            <p className="my-3">{invoice.orderNumber} · Revision {invoice.revision} · Issued {new Date(invoice.issuedAt).toLocaleDateString()}</p>
            {invoice.status === "Voided" && <p className="p-4 bg-red-50 text-red-800 rounded-xl mb-4">Voided: {invoice.voidReason}</p>}
            {invoice.supersedes && <p className="my-3">Replaces <Link className="underline" to={path(invoice.supersedes.id)}>{invoice.supersedes.number}</Link></p>}
            {invoice.supersededBy && <p className="my-3">Replacement: <Link className="underline" to={path(invoice.supersededBy.id)}>{invoice.supersededBy.number}</Link></p>}
            <div className="grid md:grid-cols-2 gap-6 my-6">{party(invoice.seller, "Seller")}{party(invoice.billing, "Bill to")}</div>
            <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr>{["Item", "Quantity", "Unit price", "Line total"].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>
                {invoice.lines.map(line => <tr key={line.id} className="border-t"><td className="p-3">{line.productName}{line.productDescription && <p className="text-sm text-neutral-500 whitespace-pre-wrap">{line.productDescription}</p>}</td><td className="p-3">{line.quantity}</td><td className="p-3 whitespace-nowrap">{formatMoney(line.unitPriceCents)}</td><td className="p-3 whitespace-nowrap">{formatMoney(line.lineTotalCents)}</td></tr>)}
            </tbody></table></div>
            <div className="text-right my-5"><p>Line subtotal: {formatMoney(invoice.subtotalCents)}</p>{invoice.adjustmentCents !== 0 && <p>Historical adjustment: {formatMoney(invoice.adjustmentCents)}</p>}<p className="font-bold text-xl mt-2">Invoice total: {formatMoney(invoice.totalCents)}</p></div>
            {invoice.notes && <p className="whitespace-pre-wrap my-4">{invoice.notes}</p>}
            <p className="text-sm text-neutral-500 my-4">Invoice issuance records the order amount. Payment is recorded separately.</p>
            <div className="flex flex-wrap gap-3"><button className={actionClass} disabled={pending} onClick={download}>Download PDF</button>
                {admin && !invoice.supersededBy && <button className={actionClass} disabled={pending} onClick={() => { setVoiding(false); setCorrection(true); }}>Correct Details</button>}
                {admin && invoice.status === "Issued" && <button className={actionClass} disabled={pending} onClick={() => { setCorrection(false); setVoiding(true); }}>Void Invoice</button>}
            </div>
            {admin && correction && <InvoiceForm initial={invoice} correction close={() => setCorrection(false)} onSave={async body => {
                const replacement = await correctInvoice(id, body); changed?.(); navigate(path(replacement.id));
            }} />}
            {admin && voiding && <form aria-label="Invoice void" onSubmit={submitVoid} className="border rounded-2xl p-4 my-5"><fieldset disabled={pending}>
                <label>Void reason<textarea className={fieldClass} required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label>
                <div className="flex gap-3 mt-3"><button className={actionClass}>Confirm Void</button><button type="button" className={actionClass} onClick={() => setVoiding(false)}>Cancel</button></div>
            </fieldset></form>}
            <h3 className="font-bold mt-8 mb-3">Invoice history</h3>
            <ol>{invoice.history.map(event => <li className="py-2 border-b" key={event.id}>{event.type}{event.reason ? ": " + event.reason : ""}<br /><span className="text-sm text-neutral-500">{event.actorName} · {new Date(event.createdAt).toLocaleString()}</span></li>)}</ol>
        </>}
    </section>;
}
