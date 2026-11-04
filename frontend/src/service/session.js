export const TOKEN_KEY = "eben_auth_token";
export const SESSION_CHANGED = "eben:session-changed";
export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please log in again.";

export function getSessionToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function saveSessionToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearSession(reason = "logout") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("eben_cart_items");
    window.dispatchEvent(new CustomEvent(SESSION_CHANGED, { detail: { reason } }));
}
