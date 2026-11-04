const prefix = "eben_checkout_attempt_v1:";

export function readCheckoutAttempt(userId) {
    try {
        const attempt = JSON.parse(localStorage.getItem(prefix + userId) || "null");
        return attempt && typeof attempt.key === "string" && typeof attempt.signature === "string" ? attempt : null;
    } catch { return null; }
}

export function checkoutAttempt(userId, items, address) {
    const contents = items.map(item => [item.id, item.quantity]).sort((a, b) => a[0] - b[0]);
    const signature = JSON.stringify({ items: contents, address: address?.trim() || null });
    const previous = readCheckoutAttempt(userId);
    if (previous?.signature === signature) return previous;
    const attempt = { key: crypto.randomUUID(), signature };
    try { localStorage.setItem(prefix + userId, JSON.stringify(attempt)); }
    catch { throw new Error("Unable to save a safe checkout attempt on this device. Please enable browser storage."); }
    return attempt;
}

export function completeCheckoutAttempt(userId, key) {
    if (readCheckoutAttempt(userId)?.key === key) localStorage.removeItem(prefix + userId);
}

export function discardCheckoutAttempt(userId) {
    localStorage.removeItem(prefix + userId);
}
