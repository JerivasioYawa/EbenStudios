import api from "./api";
import { getSessionToken } from "./session";

export const getInvoices = async (params, config) => (await api.get("/invoices", { ...config, params })).data;
export const getMyInvoices = async (params, config) => (await api.get("/invoices/mine", { ...config, params })).data;
export const getInvoice = async ({ id }, config) => (await api.get(`/invoices/${id}`, config)).data;
export const getInvoiceConfig = async (params, config) => (await api.get("/invoices/config", config)).data;
export const issueInvoice = async (orderId, body) => (await api.post(`/orders/${orderId}/invoice`, body)).data;
export const voidInvoice = async (id, body) => (await api.post(`/invoices/${id}/void`, body)).data;
export const correctInvoice = async (id, body) => (await api.post(`/invoices/${id}/corrections`, body)).data;

export async function downloadInvoice(id) {
    const token = getSessionToken();
    if (!token) throw new Error("Please log in to download your invoice.");
    let response;
    try { response = await api.get(`/invoices/${id}/pdf`, { responseType: "blob", sessionToken: token }); }
    catch (error) {
        const body = error.response?.data;
        if (body instanceof Blob) {
            try { error.message = JSON.parse(await body.text()).message || "Unable to download this invoice."; }
            catch { error.message = "Unable to download this invoice."; }
        } else if (body?.message) error.message = body.message;
        throw error;
    }
    if (token !== getSessionToken()) throw new Error("Your account changed. Please try again.");
    const name = response.headers["content-disposition"]?.match(/filename="([A-Za-z0-9._-]+\.pdf)"/)?.[1] || `invoice-${id}.pdf`;
    const url = URL.createObjectURL(response.data), link = document.createElement("a");
    try {
        link.href = url; link.download = name; document.body.appendChild(link); link.click();
    } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 0); }
}
