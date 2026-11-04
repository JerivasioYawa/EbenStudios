import api from "./api";

export const getAdminProducts = async (params, config) => (await api.get("/admin/products", { ...config, params })).data;
export const getProductHistory = async ({ id, ...params }, config) => (await api.get(`/admin/products/${id}/history`, { ...config, params })).data;
export const getAdminOrders = async (params, config) => (await api.get("/admin/orders", { ...config, params })).data;
export const getAdminOrder = async ({ id }, config) => (await api.get(`/admin/orders/${id}`, config)).data;
export const getDashboard = async (params, config) => (await api.get("/admin/dashboard", config)).data;
export const getAudit = async (params, config) => (await api.get("/admin/audit", { ...config, params })).data;
export const archiveProduct = async (id, data) => (await api.patch(`/admin/products/${id}/archive`, data)).data;
export const adjustStock = async (id, data) => (await api.post(`/admin/products/${id}/stock-adjustments`, data)).data;
export const changeFulfilment = async (id, data) => (await api.patch(`/admin/orders/${id}/fulfilment`, data)).data;
export const cancelOrder = async (id, data) => (await api.post(`/admin/orders/${id}/cancel`, data)).data;
export const confirmPayment = async (id, data) => (await api.post(`/admin/orders/${id}/payments`, data)).data;
export const recordRefund = async (id, data) => (await api.post(`/admin/orders/${id}/refunds`, data)).data;
export const updateShipping = async (id, data) => (await api.patch(`/admin/orders/${id}/shipping`, data)).data;
