import { formatCents } from "../lib/money";
import { useRef, useState } from "react";
import {
    Navigate,
    useNavigate,
} from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { createOrder } from "../service/orderService";
import Button from "../components/ui/Button";

async function fingerprintRequest(userId, payload) {
    const items = [...payload.items].sort(
        (a, b) => a.productId - b.productId
    );

    const contents = JSON.stringify({
        userId,
        items,
        shippingAddress: payload.shippingAddress,
    });

    const bytes = new TextEncoder().encode(contents);

    const digest = await crypto.subtle.digest(
        "SHA-256",
        bytes
    );

    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

async function getCheckoutAttempt(userId, payload) {
    const storageKey = `eben_checkout_attempt_${userId}`;

    const fingerprint = await fingerprintRequest(
        userId,
        payload
    );

    const stored = sessionStorage.getItem(storageKey);

    if (stored) {
        let previous = null;

        try {
            previous = JSON.parse(stored);
        } catch {
            // Replace malformed saved state below.
        }

        if (
            previous?.fingerprint === fingerprint &&
            typeof previous.key === "string" &&
            /^[A-Za-z0-9_-]{16,128}$/.test(previous.key)
        ) {
            return {
                storageKey,
                key: previous.key,
            };
        }
    }

    const key = crypto.randomUUID();

    // Store before sending the request.
    // If storage fails, submission stops rather than losing retry tracking.
    sessionStorage.setItem(
        storageKey,
        JSON.stringify({
            fingerprint,
            key,
        })
    );

    return {
        storageKey,
        key,
    };
}

export default function Checkout() {
    const {
        user,
        loading: authLoading,
    } = useAuth();

    const {
        items,
        subtotal,
        clearCart,
        cartIssue,
        refreshCart,
    } = useCart();

    const navigate = useNavigate();

    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [postalCode, setPostalCode] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    // Prevent rapid clicks before React updates the button state.
    const submissionInProgress = useRef(false);

    async function handleSubmit(event) {
        event.preventDefault();

        if (
            submissionInProgress.current ||
            !user ||
            items.length === 0 || cartIssue
        ) {
            return;
        }

        submissionInProgress.current = true;
        setSubmitting(true);
        setError("");

        try {
            const shippingParts = [
                address.trim(),
                city.trim(),
                postalCode.trim(),
            ];

            if (shippingParts.some((part) => !part)) {
                throw new Error(
                    "Complete all shipping address fields."
                );
            }

            const payload = {
                items: items.map((item) => ({
                    productId: item.id,
                    quantity: item.quantity,
                })),
                shippingAddress: shippingParts.join(", "),
            };

            const attempt = await getCheckoutAttempt(
                user.id,
                payload
            );

            const order = await createOrder(
                payload,
                attempt.key
            );

            // Clear persistent cart data before removing the retry reference.
            // If cleanup fails, retain the reference so retry remains safe.
            localStorage.removeItem("eben_cart_items");
            clearCart();

            sessionStorage.removeItem(
                attempt.storageKey
            );

            navigate("/orders", {
                state: {
                    justOrderedId: order.id,
                },
            });
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    err.message ||
                    "Order could not be confirmed. Retry without changing your cart or address."
            );
        } finally {
            submissionInProgress.current = false;
            setSubmitting(false);
        }
    }

    if (authLoading) {
        return (
            <section className="max-w-7xl mx-auto px-6 py-16">
                <p role="status">Checking your account...</p>
            </section>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (items.length === 0) {
        return (
            <section className="max-w-7xl mx-auto px-6 py-16 text-center">
                <h1 className="text-4xl font-black uppercase mb-6">
                    Your Cart Is Empty
                </h1>

                <Button variant="outline" to="/shop">
                    Continue Shopping
                </Button>
            </section>
        );
    }

    const inputClass =
        "w-full rounded-xl px-4 py-3 border border-black/20 " +
        "bg-white focus:outline-none focus:ring-2 focus:ring-black";

    return (
        <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
            <p className="uppercase tracking-[0.3em] text-sm text-neutral-500 mb-4">
                Checkout
            </p>

            <h1 className="text-4xl md:text-5xl font-black uppercase mb-10">
                Place Your Order
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <form
                    onSubmit={handleSubmit}
                    className="lg:col-span-2"
                >
                    {cartIssue && <p role="alert">{cartIssue} <button type="button" onClick={refreshCart}>Retry stock check</button></p>}
                    <h2 className="font-bold text-lg mb-4">
                        Shipping Details
                    </h2>

                    {error && (
                        <div
                            role="alert"
                            className="rounded-xl bg-red-50 text-red-700 p-4 mb-4"
                        >
                            <p>{error}</p>
                            <p className="text-sm mt-2">
                                If the result is uncertain, check your
                                orders before changing the cart or
                                starting another checkout.
                            </p>
                        </div>
                    )}

                    <fieldset
                        disabled={submitting || Boolean(cartIssue)}
                        className="flex flex-col gap-4 disabled:opacity-60"
                    >
                        <div>
                            <label
                                htmlFor="shipping-address"
                                className="block text-sm font-medium mb-2"
                            >
                                Street address
                            </label>

                            <input
                                id="shipping-address"
                                type="text"
                                autoComplete="street-address"
                                required
                                maxLength={250}
                                value={address}
                                onChange={(event) =>
                                    setAddress(event.target.value)
                                }
                                className={inputClass}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label
                                    htmlFor="shipping-city"
                                    className="block text-sm font-medium mb-2"
                                >
                                    City
                                </label>

                                <input
                                    id="shipping-city"
                                    type="text"
                                    autoComplete="address-level2"
                                    required
                                    maxLength={100}
                                    value={city}
                                    onChange={(event) =>
                                        setCity(event.target.value)
                                    }
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="shipping-postal-code"
                                    className="block text-sm font-medium mb-2"
                                >
                                    Postal code
                                </label>

                                <input
                                    id="shipping-postal-code"
                                    type="text"
                                    autoComplete="postal-code"
                                    required
                                    maxLength={20}
                                    value={postalCode}
                                    onChange={(event) =>
                                        setPostalCode(event.target.value)
                                    }
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        <p className="text-sm text-neutral-600">
                            Placing an order does not confirm payment.
                            The order will initially be Pending.
                        </p>

                        <button
                            type="submit"
                            className="bg-black text-white rounded-full py-4 font-semibold hover:bg-neutral-800 transition"
                        >
                            {submitting
                                ? "Placing Order..."
                                : "Place Order"}
                        </button>
                    </fieldset>
                </form>

                <aside className="bg-white rounded-3xl p-6 border border-black/10 h-fit">
                    <h2 className="font-bold text-lg mb-6">
                        Order Summary
                    </h2>

                    <div className="flex flex-col gap-4 mb-6">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="flex justify-between gap-4 text-sm"
                            >
                                <span>
                                    {item.name} × {item.quantity}
                                </span>

                                <span className="font-semibold">
                                    {formatCents(
                                        item.priceCents * item.quantity
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between border-t pt-4">
                        <span>Cart subtotal</span>
                        <span className="font-bold">
                            {formatCents(subtotal)}
                        </span>
                    </div>

                    <p className="text-xs text-neutral-500 mt-4">
                        The server calculates the order total using
                        current product prices. Review the confirmed
                        order total in your order history.
                    </p>
                </aside>
            </div>
        </section>
    );
}
