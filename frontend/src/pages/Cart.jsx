import { Link } from "react-router-dom";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "../hooks/useCart";
import { getProductImage } from "../lib/productImage";
import Button from "../components/ui/Button";

export default function Cart() {
    const { items, updateQuantity, removeFromCart, subtotal, loading, pending, error } = useCart();

    if (loading) return <p role="status" className="p-6">Loading your cart...</p>;

    if (items.length === 0) {
        return (
            <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16 text-center">
                <p className="uppercase tracking-[0.3em] text-sm text-neutral-500 mb-4">
                    Your Bag
                </p>

                <h1 className="text-4xl md:text-5xl font-black uppercase leading-none mb-6">
                    Cart
                </h1>

                {error
                    ? <p role="alert" className="text-red-600 mb-10">{error}</p>
                    : <p className="text-neutral-600 max-w-xl mx-auto mb-10">Your cart is empty. Start shopping to add items.</p>}

                <Button variant="outline" to="/shop">
                    Continue Shopping
                </Button>
            </section>
        );
    }

    return (
        <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
            <p className="uppercase tracking-[0.3em] text-sm text-neutral-500 mb-4">
                Your Bag
            </p>

            <h1 className="text-4xl md:text-5xl font-black uppercase leading-none mb-10">
                Cart
            </h1>

            {error && <p role="alert" className="text-red-600 mb-6">{error}</p>}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 flex flex-col gap-4">
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center gap-4 bg-white rounded-3xl p-4 border border-black/5 shadow-sm"
                        >
                            <img
                                src={getProductImage(item)}
                                alt={item.name}
                                className="w-20 h-20 rounded-2xl object-cover shrink-0"
                            />

                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold truncate">{item.name}</h3>
                                <p className="text-neutral-500 text-sm">
                                    R {Number(item.price).toLocaleString()}
                                </p>
                            </div>

                            <div className="flex items-center gap-3 border border-black/10 rounded-full px-3 py-2">
                                <button
                                    onClick={() => updateQuantity(item.id, item.quantity - 1).catch(() => {})}
                                    disabled={pending}
                                    aria-label="Decrease quantity"
                                    className="text-neutral-500 hover:text-black transition"
                                >
                                    <Minus size={14} />
                                </button>

                                <span className="w-4 text-center text-sm font-semibold">
                                    {item.quantity}
                                </span>

                                <button
                                    onClick={() => updateQuantity(item.id, item.quantity + 1).catch(() => {})}
                                    disabled={pending}
                                    aria-label="Increase quantity"
                                    className="text-neutral-500 hover:text-black transition"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>

                            <p className="w-24 text-right font-semibold">
                                R {Number(item.price * item.quantity).toLocaleString()}
                            </p>

                            <button
                                onClick={() => removeFromCart(item.id).catch(() => {})}
                                disabled={pending}
                                aria-label="Remove item"
                                className="text-neutral-400 hover:text-red-600 transition"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm h-fit">
                    <h2 className="font-bold text-lg mb-6">Order Summary</h2>

                    <div className="flex items-center justify-between mb-6 text-neutral-600">
                        <span>Subtotal</span>
                        <span className="font-semibold text-black">
                            R {Number(subtotal).toLocaleString()}
                        </span>
                    </div>

                    <Link to="/checkout" aria-disabled={pending} onClick={(event) => { if (pending) event.preventDefault(); }}
                        className="block text-center w-full bg-black text-white rounded-full py-4 font-semibold hover:bg-neutral-800 transition">
                        Proceed to Checkout
                    </Link>
                </div>
            </div>
        </section>
    );
}
