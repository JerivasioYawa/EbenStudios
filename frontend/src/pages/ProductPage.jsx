import { formatCents } from "../lib/money";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getProduct } from "../service/productService";
import { useCart } from "../hooks/useCart";
import { getProductImage } from "../lib/productImage";
import Button from "../components/ui/Button";

export default function ProductPage() {
    const { id } = useParams();
    return <ProductDetail key={id} id={id} />;
}
function ProductDetail({id}) {
    const { addToCart } = useCart();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [added, setAdded] = useState(false);

    function handleAddToCart() {
        addToCart(product);
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
    }

    useEffect(() => {
        getProduct(id)
            .then((data) => {
                setProduct(data);
                setError("");
            })
            .catch((err) => setError(err.response?.data?.message || "Product not found."))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
                <p className="text-neutral-500">Loading product...</p>
            </section>
        );
    }

    if (error || !product) {
        return (
            <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16 text-center">
                <h1 className="text-3xl font-black uppercase leading-none mb-6">
                    {error || "Product not found."}
                </h1>

                <Button variant="outline" to="/shop">
                    Back to Shop
                </Button>
            </section>
        );
    }

    return (
        <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="relative aspect-square rounded-3xl bg-neutral-200 overflow-hidden">
                    <img
                        src={getProductImage(product)}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />

                    {product.tag && (
                        <span className="absolute top-4 left-4 bg-black text-white text-xs uppercase tracking-[0.15em] px-3 py-1 rounded-full">
                            {product.tag}
                        </span>
                    )}
                </div>

                <div>
                    <p className="uppercase tracking-[0.3em] text-sm text-neutral-500 mb-4">
                        Eben Studios
                    </p>

                    <h1 className="text-4xl md:text-5xl font-black uppercase leading-none mb-6">
                        {product.name}
                    </h1>

                    <p className="text-2xl font-semibold mb-6">
                        {formatCents(product.priceCents)}
                    </p>

                    {product.description && (
                        <p className="text-neutral-600 leading-relaxed mb-6">
                            {product.description}
                        </p>
                    )}

                    <p className={`text-sm font-semibold mb-8 ${product.stock > 0 ? "text-green-600" : "text-red-600"}`}>
                        {product.stock > 0 ? `In Stock (${product.stock} available)` : "Out of Stock"}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={handleAddToCart}
                            disabled={product.stock === 0}
                            className="bg-black text-white px-8 py-4 rounded-full font-semibold hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {added ? "Added to Cart" : "Add to Cart"}
                        </button>

                        <Button variant="outline" to="/shop">
                            Back to Shop
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
}
