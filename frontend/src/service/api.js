import axios from "axios";
import { clearSession, getSessionToken, SESSION_EXPIRED_MESSAGE } from "./session";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
});

api.interceptors.request.use((config) => {
    if (config.skipAuth) return config;
    const token = config.sessionToken ?? getSessionToken();
    if (token !== getSessionToken()) {
        return Promise.reject(new Error("Your account changed. Please try again."));
    }

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        config.sessionToken = token;
    }

    return config;
});

api.interceptors.response.use((response) => response, (error) => {
    const token = error.config?.sessionToken;
    // A late failure from a previous account must not sign out the current account.
    if (error.response?.status === 401 && token && token === getSessionToken()) {
        clearSession("expired");
        error.message = SESSION_EXPIRED_MESSAGE;
        error.response.data = { ...error.response.data, message: SESSION_EXPIRED_MESSAGE };
    }
    return Promise.reject(error);
});

export default api;
