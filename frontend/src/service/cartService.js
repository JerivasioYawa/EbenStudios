import api from "./api";

export async function getCart(config = {}) {
    const { data } = await api.get("/cart", config);
    return data;
}

export async function addCartItem(productId, quantity, config = {}) {
    const { data } = await api.post("/cart/items", { productId, quantity }, config);
    return data;
}

export async function setCartQuantity(productId, quantity, config = {}) {
    const { data } = await api.patch(`/cart/items/${productId}`, { quantity }, config);
    return data;
}

export async function deleteCartItem(productId, config = {}) {
    const { data } = await api.delete(`/cart/items/${productId}`, config);
    return data;
}

export async function deleteCart(config = {}) {
    const { data } = await api.delete("/cart", config);
    return data;
}
