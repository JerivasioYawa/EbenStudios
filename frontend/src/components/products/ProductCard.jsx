import { Link } from "react-router-dom";
import { getProductImage } from "../../lib/productImage";

export default function ProductCard({ product }) {
    return (
        <Link to={`/products/${product.id}`} className="group block">
            <div className="relative aspect-[3/4] rounded-3xl bg-neutral-200 overflow-hidden mb-4">
                <img
                    src={getProductImage(product)}
                    alt={product.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />

                {product.tag && (
                    <span className="absolute top-4 left-4 bg-black text-white text-xs uppercase tracking-[0.15em] px-3 py-1 rounded-full">
                        {product.tag}
                    </span>
                )}
            </div>

            <h3 className="font-semibold text-lg mb-1">{product.name}</h3>
            <p className="text-neutral-500">R {Number(product.price).toLocaleString()}</p>
        </Link>
    );
}
