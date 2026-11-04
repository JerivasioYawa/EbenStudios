import api from "./api";

export async function getOrders() {
    const { data } = await api.get("/orders");
    return data;
}

export async function getMyOrders() {
    const { data } = await api.get("/orders/mine");
    return data;
}

export async function createOrder(order, config = {}) {
    const { data } = await api.post("/orders", order, config);
    return data;
}

export async function updateOrderStatus(id, status) {
    const { data } = await api.patch(`/orders/${id}/status`, { status });
    return data;
}
