import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import Button from "../components/ui/Button";
import { cartLineCents, formatMoney } from "../lib/money";

export default function Checkout() {
    const { items, subtotalCents, checkout, loading, pending, pendingCheckout, error: cartError } = useCart();
    const navigate = useNavigate();

    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [postalCode, setPostalCode] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    if (loading) return <p role="status" className="p-6">Loading your cart...</p>;

    if (items.length === 0) {
        return (
            <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16 text-center">
                <p className="uppercase tracking-[0.3em] text-sm text-neutral-500 mb-4">
                    Checkout
                </p>

                {cartError && <p role="alert" className="mb-4 text-red-600">{cartError}</p>}
                {pendingCheckout && <p role="alert" className="mb-4">A previous checkout may have completed. Check your orders before placing another order.</p>}
                <h1 className="text-4xl md:text-5xl font-black uppercase leading-none mb-6">
                    Your Cart Is Empty
                </h1>

                <Button variant="outline" to="/shop">
                    Continue Shopping
                </Button>
                <Link to="/orders" className="block mt-6 font-semibold underline">View Your Orders</Link>
            </section>
        );
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        setError("");

        try {
            const order = await checkout(`${address}, ${city}, ${postalCode}`);
            navigate("/orders", { state: { justOrderedId: order.id } });
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
            <p className="uppercase tracking-[0.3em] text-sm text-neutral-500 mb-4">
                Checkout
            </p>

            <h1 className="text-4xl md:text-5xl font-black uppercase leading-none mb-10">
                Checkout
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <form onSubmit={handleSubmit} className="lg:col-span-2 flex flex-col gap-4">
                    <h2 className="font-bold text-lg mb-2">Shipping Details</h2>

                    {(error || cartError) && (
                        <p role="alert" className="text-sm text-red-600">{error || cartError}</p>
                    )}

                    <input
                        type="text"
                        required
                        placeholder="Street Address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="rounded-full px-6 py-4 border border-black/10 bg-white focus:outline-none"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input
                            type="text"
                            required
                            placeholder="City"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="rounded-full px-6 py-4 border border-black/10 bg-white focus:outline-none"
                        />

                        <input
                            type="text"
                            required
                            placeholder="Postal Code"
                            value={postalCode}
                            onChange={(e) => setPostalCode(e.target.value)}
                            className="rounded-full px-6 py-4 border border-black/10 bg-white focus:outline-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || pending}
                        className="bg-black text-white rounded-full py-4 font-semibold hover:bg-neutral-800 transition disabled:opacity-50 mt-2"
                    >
                        {submitting ? "Placing Order..." : `Place Order — ${formatMoney(subtotalCents)}`}
                    </button>
                </form>

                <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm h-fit">
                    <h2 className="font-bold text-lg mb-6">Order Summary</h2>

                    <div className="flex flex-col gap-4 mb-6">
                        {items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-sm">
                                <span className="text-neutral-600">
                                    {item.name} × {item.quantity}
                                </span>
                                <span className="font-semibold">
                                    {formatMoney(cartLineCents(item))}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-between border-t border-black/5 pt-4 text-neutral-600">
                        <span>Subtotal</span>
                        <span className="font-semibold text-black">
                            {formatMoney(subtotalCents)}
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
}
