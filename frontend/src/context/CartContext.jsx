import { useEffect, useRef, useState } from "react";
import CartContext from "./cart-context";
import { useAuth } from "../hooks/useAuth";
import { getSessionToken } from "../service/session";
import { getCart, addCartItem, setCartQuantity, deleteCartItem, deleteCart } from "../service/cartService";
import { createOrder } from "../service/orderService";

export function CartProvider({ children }) {
    const { user, loading: authLoading, sessionId = 0 } = useAuth();
    const enabled = Boolean(user) && !authLoading;
    const ownerKey = enabled ? user.id + ":" + sessionId : "guest";
    const [cart, setCart] = useState(() => ({
        ownerKey, items: [], loading: enabled, pending: false, error: "",
    }));
    const active = useRef(false);
    const currentOwner = useRef(ownerKey);
    const inFlight = useRef(null);

    // Reset only this provider's state before children render for the new account.
    if (cart.ownerKey !== ownerKey) {
        setCart({ ownerKey, items: [], loading: enabled, pending: false, error: "" });
    }

    useEffect(() => {
        active.current = true;
        currentOwner.current = ownerKey;
        const controller = new AbortController();
        const token = getSessionToken();
        if (enabled) {
            getCart({ signal: controller.signal, sessionToken: token })
                .then((saved) => {
                    if (!controller.signal.aborted && token === getSessionToken()) {
                        setCart((current) => current.ownerKey === ownerKey ? { ...current, items: saved.items } : current);
                    }
                })
                .catch((failure) => {
                    if (!controller.signal.aborted && token === getSessionToken()) {
                        const error = failure.response?.data?.message || "Unable to load your cart. Please try again.";
                        setCart((current) => current.ownerKey === ownerKey ? { ...current, error } : current);
                    }
                })
                .finally(() => {
                    if (!controller.signal.aborted) {
                        setCart((current) => current.ownerKey === ownerKey ? { ...current, loading: false } : current);
                    }
                });
        }
        return () => {
            active.current = false;
            controller.abort();
        };
    }, [enabled, ownerKey]);

    async function mutate(action) {
        const token = getSessionToken();
        if (!user || authLoading || !token) throw new Error("Please log in to change your cart.");
        if (cart.loading || inFlight.current?.ownerKey === ownerKey) throw new Error("Your cart is updating. Please try again.");
        const operation = { ownerKey };
        inFlight.current = operation;
        setCart((current) => ({ ...current, pending: true, error: "" }));
        try {
            const saved = await action({ sessionToken: token });
            if (!active.current || currentOwner.current !== ownerKey || token !== getSessionToken()) {
                throw new Error("Your account changed. Please try again.");
            }
            setCart((current) => current.ownerKey === ownerKey ? { ...current, items: saved.items } : current);
            return saved;
        } catch (failure) {
            if (active.current && currentOwner.current === ownerKey && token === getSessionToken()) {
                const error = failure.response?.data?.message || failure.message || "Unable to update your cart.";
                setCart((current) => current.ownerKey === ownerKey ? { ...current, error } : current);
            }
            throw failure;
        } finally {
            if (inFlight.current === operation) inFlight.current = null;
            if (active.current) {
                setCart((current) => current.ownerKey === ownerKey ? { ...current, pending: false } : current);
            }
        }
    }

    function addToCart(product, quantity = 1) {
        return mutate((config) => addCartItem(product.id, quantity, config));
    }
    function updateQuantity(id, quantity) {
        return mutate((config) => quantity === 0 ? deleteCartItem(id, config) : setCartQuantity(id, quantity, config));
    }
    function removeFromCart(id) {
        return mutate((config) => deleteCartItem(id, config));
    }
    function clearCart() {
        return mutate((config) => deleteCart(config));
    }
    async function checkout(shippingAddress) {
        const result = await mutate(async (config) => ({
            items: [], order: await createOrder({ shippingAddress }, config),
        }));
        return result.order;
    }

    const { items, loading, pending, error } = cart;
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return (
        <CartContext.Provider value={{ items, loading, pending, error, addToCart, updateQuantity,
            removeFromCart, clearCart, checkout, itemCount, subtotal }}>
            {children}
        </CartContext.Provider>
    );
}
