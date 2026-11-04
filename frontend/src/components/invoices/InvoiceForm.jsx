import { useId, useState } from "react";
import { actionClass, fieldClass } from "../admin/ManagementControls";

export default function InvoiceForm({ initial, correction = false, onSave, close }) {
    const formId = useId();
    const [seller, setSeller] = useState(initial.seller), [billing, setBilling] = useState(initial.billing);
    const [notes, setNotes] = useState(initial.notes || ""), [reason, setReason] = useState("");
    const [pending, setPending] = useState(false), [error, setError] = useState("");
    async function submit(event) {
        event.preventDefault(); setPending(true); setError("");
        try { await onSave({ seller, billing, notes, ...(correction ? { reason } : {}) }); }
        catch (failure) { setError(failure.response?.data?.message || failure.message || "Unable to save this invoice."); }
        finally { setPending(false); }
    }
    function fields(value, setValue, label, phone = false) {
        return <div><h3 className="font-bold text-lg mb-3">{label}</h3>{[
            ["name", "name", 200, true], ["email", "email", 254, true], ["address", "address", 2000, true],
            ["registrationNumber", "registration number", 80], ["taxNumber", "tax registration", 80], ...(phone ? [["phone", "phone", 60]] : []),
        ].map(([key, title, max, required]) => <div className="my-3" key={key}><label className="block" htmlFor={`${formId}-${label}-${key}`}>{label} {title}</label>
            {key === "address" ? <textarea id={`${formId}-${label}-${key}`} className={fieldClass} required={required} maxLength={max} value={value[key] || ""} onChange={event => setValue(current => ({ ...current, [key]: event.target.value }))} />
                : <input id={`${formId}-${label}-${key}`} className={fieldClass} type={key === "email" ? "email" : "text"} required={required} maxLength={max} value={value[key] || ""} onChange={event => setValue(current => ({ ...current, [key]: event.target.value }))} />}
        </div>)}</div>;
    }
    return <form aria-label={correction ? "Invoice correction" : "Invoice issuance"} onSubmit={submit} className="border rounded-2xl p-5 my-5">
        <h3 className="font-bold text-xl">{correction ? "Correct invoice details" : "Prepare invoice"}</h3>
        <p className="text-sm text-neutral-600 my-3">Confirm seller and billing details before issuing. Amounts use the saved order. Issuing an invoice does not confirm payment.</p>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <fieldset disabled={pending}>
            <div className="grid lg:grid-cols-2 gap-6">{fields(seller, setSeller, "Seller", true)}{fields(billing, setBilling, "Billing")}</div>
            <div className="my-3"><label className="block" htmlFor={formId + "-notes"}>Invoice notes</label><textarea id={formId + "-notes"} className={fieldClass} maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} /></div>
            {correction && <div className="my-3"><label className="block" htmlFor={formId + "-reason"}>Correction reason</label><textarea id={formId + "-reason"} className={fieldClass} required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></div>}
            <div className="flex gap-3"><button className={actionClass}>{pending ? "Saving..." : correction ? "Issue Replacement" : "Issue Invoice"}</button><button type="button" className={actionClass} onClick={close}>Cancel</button></div>
        </fieldset>
    </form>;
}
