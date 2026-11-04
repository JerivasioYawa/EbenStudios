import api from "./api";

export async function login(email, password) {
    const { data } = await api.post("/auth/login", { email, password }, { skipAuth: true });
    return data;
}

export async function register(name, email, password) {
    const { data } = await api.post("/auth/register", { name, email, password }, { skipAuth: true });
    return data;
}

export async function getCurrentUser(config = {}) {
    const { data } = await api.get("/auth/me", config);
    return data.user;
}
