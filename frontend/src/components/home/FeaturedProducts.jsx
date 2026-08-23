import Button from "../ui/Button";
import { getProductImage } from "../../lib/productImage";

const products = [
    { name: "Woodstock Hoodie", price: "R 1,199", tag: "New" },
    { name: "Streets Tee", price: "R 549", tag: "Best Seller" },
    { name: "Culture Bomber", price: "R 2,399", tag: "Limited" },
    { name: "Movement Cap", price: "R 399", tag: "New" },
];

export default function FeaturedProducts() {
    return (
        <section className="bg-white py-16">
            <div className="max-w-7xl mx-auto px-6 lg:px-10">
                <div className="flex items-end justify-between mb-10">
                    <div>
                        <p className="uppercase tracking-[0.3em] text-sm text-neutral-500 mb-4">
                            Fresh Drops
                        </p>

                        <h2 className="text-4xl md:text-5xl font-black uppercase leading-none">
                            Featured Products
                        </h2>
                    </div>

                    <Button variant="outline" to="/shop">View All</Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {products.map((product) => (
                        <div key={product.name} className="group">
                            <div className="relative aspect-[3/4] rounded-3xl bg-neutral-200 overflow-hidden mb-4">
                                <img
                                    src={getProductImage(product)}
                                    alt={product.name}
                                    loading="lazy"
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                />

                                <span className="absolute top-4 left-4 bg-black text-white text-xs uppercase tracking-[0.15em] px-3 py-1 rounded-full">
                                    {product.tag}
                                </span>
                            </div>

                            <h3 className="font-semibold text-lg mb-1">
                                {product.name}
                            </h3>

                            <p className="text-neutral-500">
                                {product.price}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
