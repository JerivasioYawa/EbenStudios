import { useCallback, useEffect, useState } from "react";
import CartContext from "./cart-context";
import { getProducts } from "../service/productService";

const STORAGE_KEY = "eben_cart_items";
function readSelections() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        return Array.isArray(saved) ? saved.filter(item => Number.isSafeInteger(item?.id) && item.id > 0 && Number.isSafeInteger(item.quantity) && item.quantity > 0 && item.quantity <= 100).map(({id, quantity}) => ({id, quantity})) : [];
    } catch { return []; }
}
export function CartProvider({ children }) {
    const [selections, setSelections] = useState(readSelections);
    const [catalogue, setCatalogue] = useState([]);
    const [catalogueState, setCatalogueState] = useState("loading");
    const refreshCart = useCallback(async () => {
        try { const products = await getProducts(); setCatalogue(products); setCatalogueState("ready"); }
        catch { setCatalogueState("error"); }
    }, []);
    useEffect(() => {
        let active = true;
        getProducts().then(products => { if(active) { setCatalogue(products); setCatalogueState("ready"); } }).catch(() => { if(active) setCatalogueState("error"); });
        const refresh = () => refreshCart(); window.addEventListener("focus",refresh); return () => { active = false; window.removeEventListener("focus",refresh); }; }, [refreshCart]);
    useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(selections)); } catch { /* Keep the current in-memory basket usable. */ } }, [selections]);
    const items = selections.map(selection => {
        const product = catalogue.find(p => p.id === selection.id);
        return {...selection, ...(product || {name:`Unavailable product #${selection.id}`}), quantity:selection.quantity, unavailable:!product, exceedsStock:product ? selection.quantity > product.stock : false};
    });
    const cartIssue = catalogueState === "loading" ? "Checking current prices and stock..." : catalogueState === "error" ? "Cannot check prices and stock. Your selections are preserved. Retry before checkout." : items.some(i => i.unavailable || i.exceedsStock) ? "Remove unavailable products or reduce quantities to the available stock before checkout." : "";
    function addToCart(product, quantity = 1) {
        if (!Number.isSafeInteger(quantity) || quantity < 1) return;
        setSelections(current => { const existing=current.find(i=>i.id===product.id); const next=Math.min(100,product.stock,(existing?.quantity || 0)+quantity); if(next<1)return current; return existing ? current.map(i=>i.id===product.id?{...i,quantity:next}:i) : [...current,{id:product.id,quantity:next}]; });
    }
    function removeFromCart(id) { setSelections(current=>current.filter(i=>i.id!==id)); }
    function updateQuantity(id, quantity) {
        if (!Number.isSafeInteger(quantity) || quantity > 100) return;
        if (quantity <= 0) return removeFromCart(id);
        setSelections(current=>current.map(i=>i.id===id?{...i,quantity}:i));
    }
    function clearCart() { setSelections([]); refreshCart(); }
    const itemCount=items.reduce((sum,item)=>sum+item.quantity,0);
    const subtotal=items.every(i=>Number.isSafeInteger(i.priceCents)) ? items.reduce((sum,item)=>sum+item.priceCents*item.quantity,0) : null;
    return <CartContext.Provider value={{items,addToCart,updateQuantity,removeFromCart,clearCart,itemCount,subtotal,cartIssue,refreshCart}}>{children}</CartContext.Provider>;
}
