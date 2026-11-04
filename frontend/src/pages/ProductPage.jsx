import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getProduct } from "../service/productService";
import { useCart } from "../hooks/useCart";
import { useAuth } from "../hooks/useAuth";
import { returnTo } from "../lib/loginReturn";
import { getProductImage } from "../lib/productImage";
import Button from "../components/ui/Button";
import LikeButton from "../components/products/LikeButton";
import { formatMoney } from "../lib/money";

export default function ProductPage() {
    const { id } = useParams();
    const { addToCart, loading: cartLoading, pending } = useCart();
    const { user, loading: authLoading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [added, setAdded] = useState(false);
    const [cartError, setCartError] = useState("");

    async function handleAddToCart() {
        if (!user) {
            navigate("/login", { state: { from: returnTo(location) } });
            return;
        }
        setCartError("");
        try {
            await addToCart(product);
            setAdded(true);
        } catch (failure) {
            setCartError(failure.response?.data?.message || failure.message || "Unable to add this item.");
        }
    }

    useEffect(() => {
        if (!added) return;
        const timer = setTimeout(() => setAdded(false), 2000);
        return () => clearTimeout(timer);
    }, [added]);

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

                    <div className="flex items-start justify-between gap-4 mb-6">
                    <h1 className="text-4xl md:text-5xl font-black uppercase leading-none">
                        {product.name}
                    </h1>
                    <LikeButton product={product} className="shrink-0" />
                    </div>

                    <p className="text-2xl font-semibold mb-6">
                        {formatMoney(product.priceCents)}
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
                            disabled={authLoading || pending || (Boolean(user) && (product.stock === 0 || cartLoading))}
                            className="bg-black text-white px-8 py-4 rounded-full font-semibold hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {!user ? "Log in to add to cart." : pending ? "Adding..." : added ? "Added to Cart" : "Add to Cart"}
                        </button>

                        <Button variant="outline" to="/shop">
                            Back to Shop
                        </Button>
                    </div>
                    {cartError && <p role="alert" className="mt-4 text-sm text-red-600">{cartError}</p>}
                </div>
            </div>
        </section>
    );
}
