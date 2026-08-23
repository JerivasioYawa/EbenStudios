import api from "./api";

export async function getProducts() {
    const { data } = await api.get("/products");
    return data;
}

export async function getProduct(id) {
    const { data } = await api.get(`/products/${id}`);
    return data;
}

function toFormData(product) {
    const formData = new FormData();

    Object.entries(product).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            formData.append(key, value);
        }
    });

    return formData;
}

export async function createProduct(product) {
    const { data } = await api.post("/products", toFormData(product));
    return data;
}

export async function updateProduct(id, product) {
    const { data } = await api.put(`/products/${id}`, toFormData(product));
    return data;
}

export async function deleteProduct(id) {
    await api.delete(`/products/${id}`);
}
