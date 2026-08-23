import { useEffect, useState } from "react";
import { getProducts } from "../service/productService";
import ProductGrid from "../components/products/ProductGrid";

export default function Shop() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        getProducts()
            .then(setProducts)
            .catch((err) => setError(err.response?.data?.message || "Failed to load products."))
            .finally(() => setLoading(false));
    }, []);

    return (
        <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
            <p className="uppercase tracking-[0.3em] text-sm text-neutral-500 mb-4">
                All Products
            </p>

            <h1 className="text-4xl md:text-5xl font-black uppercase leading-none mb-10">
                Shop
            </h1>

            {loading && (
                <p className="text-neutral-500">Loading products...</p>
            )}

            {error && (
                <p className="text-red-600">{error}</p>
            )}

            {!loading && !error && products.length === 0 && (
                <p className="text-neutral-600 max-w-2xl">
                    No products available yet. Check back shortly for the
                    latest Eben Studios drops.
                </p>
            )}

            {!loading && !error && products.length > 0 && (
                <ProductGrid products={products} />
            )}
        </section>
    );
}
