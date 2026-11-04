import api from "./api";
import { consumeGuestLike, readGuestLikes } from "./guestLikes";
import { getSessionToken } from "./session";

export async function getLikes(config = {}) {
    const { data } = await api.get("/likes", config);
    return data;
}

export async function likeProduct(productId, config = {}) {
    const { data } = await api.put(`/likes/${productId}`, {}, config);
    return data;
}

export async function unlikeProduct(productId, config = {}) {
    await api.delete(`/likes/${productId}`, config);
}

export async function mergeGuestLikes(config) {
    for (const productId of readGuestLikes()) {
        if (config.sessionToken !== getSessionToken()) throw new Error("Your account changed. Please try again.");
        try {
            await likeProduct(productId, config);
        } catch (error) {
            if (error.response?.status !== 404) throw error;
            // A deleted product cannot be liked again; discard that stale guest ID.
        }
        if (config.sessionToken !== getSessionToken()) throw new Error("Your account changed. Please try again.");
        consumeGuestLike(productId);
    }
}
