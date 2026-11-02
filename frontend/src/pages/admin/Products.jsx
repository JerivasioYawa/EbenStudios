import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Archive, X, Upload } from "lucide-react";
import {
    getProducts,
    getArchivedProducts,
    restoreProduct,
    createProduct,
    updateProduct,
    deleteProduct,
} from "../../service/productService";
import { getProductImage } from "../../lib/productImage";

const emptyForm = { name: "", description: "", price: "", stock: "", tag: "" };

export default function Products() {
    const [products, setProducts] = useState([]);
    const [archived, setArchived] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [imageFile, setImageFile] = useState(null);
    const [existingImageUrl, setExistingImageUrl] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const previewUrl = useMemo(
        () => (imageFile ? URL.createObjectURL(imageFile) : null),
        [imageFile]
    );

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    useEffect(() => {
        loadProducts();
    }, []);

    async function loadProducts() {
        setLoading(true);
        setError("");

        try {
            const [active, hidden] = await Promise.all([getProducts(), getArchivedProducts()]);
            setProducts(active); setArchived(hidden);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load products.");
        } finally {
            setLoading(false);
        }
    }

    async function handleRestore(id) {
        try { await restoreProduct(id); await loadProducts(); }
        catch (err) { setError(err.response?.data?.message || "Restore failed."); }
    }

    function openAddForm() {
        setEditingId(null);
        setForm(emptyForm);
        setImageFile(null);
        setExistingImageUrl(null);
        setFormError("");
        setFormOpen(true);
    }

    function openEditForm(product) {
        setEditingId(product.id);
        setForm({
            name: product.name,
            description: product.description || "",
            price: product.price,
            stock: product.stock,
            tag: product.tag || "",
        });
        setImageFile(null);
        setExistingImageUrl(product.imageUrl || null);
        setFormError("");
        setFormOpen(true);
    }

    function closeForm() {
        setFormOpen(false);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        setFormError("");

        try {
            const payload = { ...form, image: imageFile };

            if (editingId) {
                await updateProduct(editingId, payload);
            } else {
                await createProduct(payload);
            }

            closeForm();
            await loadProducts();
        } catch (err) {
            setFormError(err.response?.data?.message || "Failed to save product.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id) {
        setDeletingId(id);

        try {
            await deleteProduct(id);
            setConfirmDeleteId(null);
            await loadProducts();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to archive product.");
        } finally {
            setDeletingId(null);
        }
    }

    const displayImage = previewUrl || existingImageUrl;

    return (
        <div>
            <section className="mb-8" aria-label="Archived products"><h2 className="font-bold">Archived products</h2>{archived.length ? archived.map(product => <p key={product.id}>{product.name} <button className="underline ml-4" onClick={() => handleRestore(product.id)}>Restore</button></p>) : <p>No archived products.</p>}</section>
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-black uppercase leading-none">
                    Products
                </h1>

                <button
                    onClick={openAddForm}
                    className="flex items-center gap-2 bg-black text-white px-5 py-3 rounded-full font-semibold hover:bg-neutral-800 transition"
                >
                    <Plus size={18} />
                    Add Product
                </button>
            </div>

            {formOpen && (
                <form
                    onSubmit={handleSubmit}
                    className="bg-white rounded-3xl border border-black/5 shadow-sm p-6 mb-6"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-lg">
                            {editingId ? "Edit Product" : "New Product"}
                        </h2>

                        <button aria-label="Close product form" type="button" onClick={closeForm} className="text-neutral-400 hover:text-black transition">
                            <X size={20} />
                        </button>
                    </div>

                    {formError && (
                        <p className="text-sm text-red-600 mb-4">{formError}</p>
                    )}

                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-20 h-20 rounded-2xl bg-neutral-100 overflow-hidden shrink-0">
                            {displayImage && (
                                <img src={displayImage} alt="Preview" className="w-full h-full object-cover" />
                            )}
                        </div>

                        <label className="flex items-center gap-2 border border-black/10 rounded-full px-4 py-2 text-sm font-semibold cursor-pointer hover:bg-neutral-50 transition">
                            <Upload size={16} />
                            {imageFile ? imageFile.name : "Upload Image"}
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                                className="sr-only"
                            />
                        </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <label className="flex flex-col gap-2">Name<input
                            type="text"
                            required
                            placeholder="Name"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="rounded-xl px-4 py-3 border border-black/10 focus:outline-none"
                        /></label>

                        <label className="flex flex-col gap-2">Tag (e.g. New, Limited)<input
                            type="text"
                            placeholder="Tag (e.g. New, Limited)"
                            value={form.tag}
                            onChange={(e) => setForm({ ...form, tag: e.target.value })}
                            className="rounded-xl px-4 py-3 border border-black/10 focus:outline-none"
                        /></label>

                        <label className="flex flex-col gap-2">Price<input
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            placeholder="Price"
                            value={form.price}
                            onChange={(e) => setForm({ ...form, price: e.target.value })}
                            className="rounded-xl px-4 py-3 border border-black/10 focus:outline-none"
                        /></label>

                        <label className="flex flex-col gap-2">Stock<input
                            type="number"
                            required
                            min="0"
                            placeholder="Stock"
                            value={form.stock}
                            onChange={(e) => setForm({ ...form, stock: e.target.value })}
                            className="rounded-xl px-4 py-3 border border-black/10 focus:outline-none"
                        /></label>

                        <label className="flex flex-col gap-2">Description<textarea
                            placeholder="Description"
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="rounded-xl px-4 py-3 border border-black/10 focus:outline-none sm:col-span-2"
                            rows={2}
                        /></label>
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-black text-white px-5 py-3 rounded-full font-semibold hover:bg-neutral-800 transition disabled:opacity-50"
                    >
                        {saving ? "Saving..." : editingId ? "Save Changes" : "Create Product"}
                    </button>
                </form>
            )}

            {error && (
                <p className="text-sm text-red-600 mb-4">{error}</p>
            )}

            <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-black/5 text-sm text-neutral-500">
                            <th className="px-6 py-4 font-medium" aria-label="Image"></th>
                            <th className="px-6 py-4 font-medium">Name</th>
                            <th className="px-6 py-4 font-medium">Price</th>
                            <th className="px-6 py-4 font-medium">Stock</th>
                            <th className="px-6 py-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                                    Loading products...
                                </td>
                            </tr>
                        )}

                        {!loading && products.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                                    No products yet.
                                </td>
                            </tr>
                        )}

                        {!loading && products.map((product) => (
                            <tr key={product.id} className="border-b border-black/5 last:border-0">
                                <td className="px-6 py-4">
                                    <img
                                        src={getProductImage(product)}
                                        alt={product.name}
                                        className="w-12 h-12 rounded-xl object-cover"
                                    />
                                </td>
                                <td className="px-6 py-4 font-semibold">{product.name}</td>
                                <td className="px-6 py-4 text-neutral-600">
                                    R {Number(product.price).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-neutral-600">{product.stock}</td>
                                <td className="px-6 py-4">
                                    {confirmDeleteId === product.id ? (
                                        <div className="flex items-center justify-end gap-3 text-sm">
                                            <span className="text-neutral-500">Archive?</span>
                                            <button
                                                onClick={() => handleDelete(product.id)}
                                                disabled={deletingId === product.id}
                                                className="font-semibold text-red-600 hover:text-red-700 transition disabled:opacity-50"
                                            >
                                                {deletingId === product.id ? "Archiving..." : "Confirm"}
                                            </button>
                                            <button
                                                onClick={() => setConfirmDeleteId(null)}
                                                className="text-neutral-500 hover:text-black transition"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-end gap-3 text-neutral-400">
                                            <button
                                                onClick={() => openEditForm(product)}
                                                className="hover:text-black transition"
                                                aria-label="Edit"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => setConfirmDeleteId(product.id)}
                                                className="hover:text-red-600 transition"
                                                aria-label="Archive"
                                            >
                                                <Archive size={16} />
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
