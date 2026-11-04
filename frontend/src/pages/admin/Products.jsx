import { useEffect, useMemo, useState } from "react";
import { createProduct, updateProduct, deleteProduct } from "../../service/productService";
import { adjustStock, archiveProduct, getAdminProducts, getProductHistory } from "../../service/adminService";
import { useAdminQuery } from "../../hooks/useAdminQuery";
import { actionClass, fieldClass, Pagination, QueryState } from "../../components/admin/ManagementControls";
import { formatMoney } from "../../lib/money";
import { getProductImage } from "../../lib/productImage";

function ProductForm({ product, close, saved }) {
    const [form, setForm] = useState({ name: product?.name || "", price: product?.price ?? "", stock: "0",
        description: product?.description || "", tag: product?.tag || "", lowStockThreshold: product?.lowStockThreshold ?? 5 });
    const [image, setImage] = useState(null), [pending, setPending] = useState(false), [error, setError] = useState("");
    const preview = useMemo(() => image ? URL.createObjectURL(image) : null, [image]);
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
    const change = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
    async function submit(event) {
        event.preventDefault(); setPending(true); setError("");
        try {
            const payload = { ...form, image };
            if (product) { delete payload.stock; await updateProduct(product.id, payload); }
            else await createProduct(payload);
            saved();
        } catch (failure) { setError(failure.response?.data?.message || "Unable to save this product."); }
        finally { setPending(false); }
    }
    return <form onSubmit={submit} aria-label="Product editor" className="bg-white rounded-3xl border border-black/5 p-6 mb-6">
        <div className="flex justify-between mb-4"><h2 className="text-xl font-bold">{product ? "Edit Product" : "New Product"}</h2><button type="button" className={actionClass} onClick={close}>Close editor</button></div>
        {error && <p role="alert" className="text-red-700 mb-4">{error}</p>}
        <div className="grid sm:grid-cols-2 gap-4">
            <label>Name<input className={fieldClass} name="name" placeholder="Name" required maxLength={120} value={form.name} onChange={change} /></label>
            <label>Tag<input className={fieldClass} name="tag" placeholder="Tag (e.g. New, Limited)" maxLength={80} value={form.tag} onChange={change} /></label>
            <label>Price (ZAR)<input className={fieldClass} name="price" placeholder="Price" type="number" min="0" max="21474836.47" step="0.01" required value={form.price} onChange={change} /></label>
            {!product && <label>Initial stock<input className={fieldClass} name="stock" placeholder="Stock" type="number" min="0" max="2147483647" step="1" required value={form.stock} onChange={change} /></label>}
            <label>Low stock threshold<input className={fieldClass} name="lowStockThreshold" type="number" min="0" max="2147483647" step="1" required value={form.lowStockThreshold} onChange={change} /></label>
            <label className="sm:col-span-2">Description<textarea className={fieldClass} name="description" placeholder="Description" maxLength={5000} value={form.description} onChange={change} /></label>
            <label>Upload Image<input className={fieldClass} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => setImage(event.target.files?.[0] || null)} /></label>
            {(preview || product?.imageUrl) && <img src={preview || product.imageUrl} alt="Product preview" className="w-24 h-24 object-cover rounded-xl" />}
        </div>
        <p className="text-sm text-neutral-500 my-3">JPEG, PNG, WebP or GIF, up to 5 MB. Images are validated and normalized before saving.</p>
        {product && <p className="text-sm mb-3">Use Adjust Stock to record inventory changes with a reason.</p>}
        <button className={actionClass} disabled={pending}>{pending ? "Saving..." : product ? "Save Changes" : "Create Product"}</button>
    </form>;
}

function ProductAction({ action, close, saved }) {
    const [reason, setReason] = useState(""), [delta, setDelta] = useState("");
    const [pending, setPending] = useState(false), [error, setError] = useState("");
    const stock = action.kind === "stock";
    const title = stock ? "Adjust Stock" : action.kind === "archive" ? "Archive Product" : "Restore Product";
    async function submit(event) {
        event.preventDefault(); setPending(true); setError("");
        try {
            if (stock) await adjustStock(action.product.id, { delta: Number(delta), reason });
            else await archiveProduct(action.product.id, { archived: action.kind === "archive", reason });
            saved();
        } catch (failure) { setError(failure.response?.data?.message || "Unable to save this change."); }
        finally { setPending(false); }
    }
    return <form aria-label={title} onSubmit={submit} className="p-6 border rounded-3xl bg-white mb-6">
        <h2 className="font-bold text-xl mb-4">{title}: {action.product.name}</h2>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {stock && <label>Adjustment (positive or negative)<input aria-label="Stock adjustment" className={fieldClass} type="number" step="1" required value={delta} onChange={event => setDelta(event.target.value)} /></label>}
        <label>Reason<textarea className={fieldClass} required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label>
        <div className="flex gap-3 mt-4"><button className={actionClass} disabled={pending}>Save {stock ? "Adjustment" : "Status"}</button><button type="button" className={actionClass} onClick={close}>Cancel</button></div>
    </form>;
}

function ProductHistory({ productId, revision, close }) {
    const [page, setPage] = useState(1), [retry, setRetry] = useState(0);
    const result = useAdminQuery(getProductHistory, { id: productId, page, pageSize: 10 }, revision + retry);
    const history = result.data;
    return <section aria-label="Product history" className="p-6 border rounded-3xl bg-white mt-6">
        <div className="flex justify-between"><h2 className="font-bold text-xl">Product history{history ? ": " + history.product.name : ""}</h2><button className={actionClass} onClick={close}>Close history</button></div>
        <QueryState {...result} retry={() => setRetry(retry + 1)} />
        {history && <>
            <h3 className="font-bold mt-6 mb-3">Stock adjustments</h3>
            {history.adjustments.items.length === 0 && <p>No adjustments on this page.</p>}
            <ul className="space-y-3">{history.adjustments.items.map(row => <li key={row.id} className="border-b pb-3">
                <strong>{row.delta > 0 ? "+" : ""}{row.delta}</strong> ({row.beforeStock} → {row.afterStock}) · {row.reason}<br />
                <span className="text-sm text-neutral-500">{row.actorName} · {new Date(row.createdAt).toLocaleString()} · {row.kind}{row.orderId ? ` · Order #EB-${row.orderId}` : ""}</span>
            </li>)}</ul>
            <h3 className="font-bold mt-6 mb-3">Admin activity</h3>
            <ul className="space-y-3">{history.audit.items.map(row => <li key={row.id}>{row.action}{row.reason ? " · " + row.reason : ""}<br /><span className="text-sm text-neutral-500">{row.actorName} · {new Date(row.createdAt).toLocaleString()}</span></li>)}</ul>
            <Pagination page={page} totalPages={Math.max(history.audit.totalPages, history.adjustments.totalPages)} total={history.audit.total + history.adjustments.total} onChange={setPage} />
        </>}
    </section>;
}

export default function Products() {
    const [filters, setFilters] = useState({ q: "", status: "active", stock: "all", tag: "", page: 1, pageSize: 10 });
    const [revision, setRevision] = useState(0), [editor, setEditor] = useState(null), [action, setAction] = useState(null);
    const [historyId, setHistoryId] = useState(null), [deleteId, setDeleteId] = useState(null), [pending, setPending] = useState(false), [error, setError] = useState("");
    const result = useAdminQuery(getAdminProducts, filters, revision);
    const filter = event => setFilters(current => ({ ...current, [event.target.name]: event.target.value, page: 1 }));
    function saved() { setEditor(null); setAction(null); setError(""); setRevision(current => current + 1); }
    async function remove(id) {
        setPending(true); setError("");
        try { await deleteProduct(id); setDeleteId(null); if (historyId === id) setHistoryId(null); saved(); }
        catch (failure) { setError(failure.response?.data?.message || "Unable to delete this product."); }
        finally { setPending(false); }
    }
    return <div>
        <div className="flex justify-between items-center mb-8"><h1 className="text-3xl font-black uppercase">Products</h1><button className={actionClass} onClick={() => { setAction(null); setEditor({}); }}>Add Product</button></div>
        {editor && <ProductForm key={editor.id || "new"} product={editor.id ? editor : null} close={() => setEditor(null)} saved={saved} />}
        {action && <ProductAction key={action.product.id + action.kind} action={action} close={() => setAction(null)} saved={saved} />}
        {error && <p role="alert" className="text-red-700 mb-4">{error}</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <label>Search products<input className={fieldClass} name="q" value={filters.q} maxLength={120} onChange={filter} /></label>
            <label>Visibility<select className={fieldClass} name="status" value={filters.status} onChange={filter}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select></label>
            <label>Stock filter<select className={fieldClass} name="stock" value={filters.stock} onChange={filter}><option value="all">All stock</option><option value="low">Low stock</option><option value="out">Out of stock</option><option value="available">In stock</option></select></label>
            <label>Filter by tag<input className={fieldClass} name="tag" value={filters.tag} maxLength={80} onChange={filter} /></label>
            <label>Products per page<select className={fieldClass} name="pageSize" value={filters.pageSize} onChange={filter}>{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
        </div>
        <QueryState {...result} retry={() => setRevision(revision + 1)} />
        {result.data && <>
            <div className="overflow-x-auto bg-white border rounded-3xl"><table className="w-full text-left">
                <thead><tr>{["Image", "Name", "Price", "Stock", "Visibility", "Actions"].map(title => <th className="p-4" key={title}>{title}</th>)}</tr></thead>
                <tbody>{result.data.items.map(product => <tr key={product.id} className="border-t">
                    <td className="p-4"><img src={getProductImage(product)} alt={product.name} className="w-12 h-12 rounded-xl object-cover" /></td>
                    <td className="p-4 font-semibold">{product.name}</td><td className="p-4">{formatMoney(product.priceCents)}</td>
                    <td className="p-4"><span>{product.stock}</span>{product.lowStock && <span className="block text-xs font-bold text-amber-800">{product.stock === 0 ? "Out of stock" : "Low stock"}</span>}</td>
                    <td className="p-4">{product.archivedAt ? "Archived" : "Active"}</td>
                    <td className="p-4"><div className="flex flex-wrap gap-2">
                        <button className={actionClass} onClick={() => { setAction(null); setEditor(product); }}>Edit</button>
                        <button className={actionClass} onClick={() => { setEditor(null); setAction({ product, kind: "stock" }); }}>Adjust Stock</button>
                        <button className={actionClass} onClick={() => { setEditor(null); setAction({ product, kind: product.archivedAt ? "restore" : "archive" }); }}>{product.archivedAt ? "Restore" : "Archive"}</button>
                        <button className={actionClass} onClick={() => setHistoryId(product.id)}>History</button>
                        {deleteId === product.id ? <><button className={actionClass} disabled={pending} onClick={() => remove(product.id)}>Confirm</button><button className={actionClass} onClick={() => setDeleteId(null)}>Cancel Delete</button></> : <button className={actionClass} onClick={() => setDeleteId(product.id)}>Delete</button>}
                    </div></td>
                </tr>)}</tbody>
            </table>{result.data.total === 0 && <p className="p-6">No matching products.</p>}</div>
            <Pagination {...result.data} onChange={page => setFilters(current => ({ ...current, page }))} />
        </>}
        {historyId && <ProductHistory key={historyId} productId={historyId} revision={revision} close={() => setHistoryId(null)} />}
    </div>;
}
