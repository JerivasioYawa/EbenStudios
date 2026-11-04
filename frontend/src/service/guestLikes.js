export const GUEST_LIKES_KEY = "eben_guest_likes_v1";
export const GUEST_LIKES_CHANGED = "eben:guest-likes-changed";

function validIds(values) {
    return [...new Set(values.filter(id => Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647))];
}

export function readGuestLikes() {
    try {
        const values = JSON.parse(localStorage.getItem(GUEST_LIKES_KEY) || "[]");
        return Array.isArray(values) ? validIds(values) : [];
    } catch { return []; }
}

function saveGuestLikes(ids) {
    try {
        if (ids.length) localStorage.setItem(GUEST_LIKES_KEY, JSON.stringify(ids));
        else localStorage.removeItem(GUEST_LIKES_KEY);
    } catch {
        throw new Error("Unable to save your likes on this device.");
    }
    window.dispatchEvent(new Event(GUEST_LIKES_CHANGED));
    return ids;
}

export function toggleGuestLike(productId) {
    const ids = readGuestLikes();
    return saveGuestLikes(ids.includes(productId) ? ids.filter(id => id !== productId) : validIds([...ids, productId]));
}

export function consumeGuestLike(productId) {
    saveGuestLikes(readGuestLikes().filter(id => id !== productId));
}
