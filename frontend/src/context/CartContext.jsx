import { useEffect, useState } from "react";
import CartContext from "./cart-context";

const STORAGE_KEY = "eben_cart_items";

export function CartProvider({ children }) {
    const [items, setItems] = useState(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }, [items]);

    function addToCart(product, quantity = 1) {
        setItems((current) => {
            const existing = current.find((item) => item.id === product.id);

            if (existing) {
                return current.map((item) =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            }

            return [
                ...current,
                {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    tag: product.tag,
                    imageUrl: product.imageUrl,
                    quantity,
                },
            ];
        });
    }

    function updateQuantity(id, quantity) {
        if (quantity <= 0) {
            removeFromCart(id);
            return;
        }

        setItems((current) =>
            current.map((item) => (item.id === id ? { ...item, quantity } : item))
        );
    }

    function removeFromCart(id) {
        setItems((current) => current.filter((item) => item.id !== id));
    }

    function clearCart() {
        setItems([]);
    }

    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return (
        <CartContext.Provider
            value={{ items, addToCart, updateQuantity, removeFromCart, clearCart, itemCount, subtotal }}
        >
            {children}
        </CartContext.Provider>
    );
}
