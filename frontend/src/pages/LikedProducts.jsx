import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProducts } from "../service/productService";
import { useLikes } from "../hooks/useLikes";
import ProductGrid from "../components/products/ProductGrid";

export default function LikedProducts() {
    const { isLiked, loading: likesLoading, error: likesError, refreshLikes, pendingIds } = useLikes();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let active = true;
        getProducts().then(data => { if (active) { setProducts(data); setError(""); } })
            .catch(() => { if (active) setError("Unable to load liked products. Please try again."); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [attempt]);

    function retry() {
        setLoading(true);
        setError("");
        setAttempt(value => value + 1);
        refreshLikes();
    }

    const liked = products.filter(product => isLiked(product.id));
    const failure = error || likesError;
    return <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <h1 className="text-4xl md:text-5xl font-black uppercase leading-none mb-6">Liked Products</h1>
        <p className="text-neutral-600 mb-10">Your saved favourites, ready when you are.</p>
        {(loading || likesLoading) && <p role="status">Loading your likes...</p>}
        {failure && <div className="mb-6">
            <p role="alert" className="text-red-600 mb-4">{failure}</p>
            <button type="button" onClick={retry} disabled={loading || likesLoading || pendingIds.length > 0}
                className="rounded-full bg-black px-6 py-3 font-semibold text-white disabled:opacity-50">Try Again</button>
        </div>}
        {!loading && !likesLoading && !failure && (liked.length
            ? <ProductGrid products={liked} />
            : <div><p className="mb-6">No liked products yet. Use the heart on a product to save it here.</p>
                <Link to="/shop" className="font-semibold underline">Browse Products</Link></div>)}
    </section>;
}
