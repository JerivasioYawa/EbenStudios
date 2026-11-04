export function returnTo(location) {
    return `${location.pathname}${location.search}${location.hash}`;
}

export function safeLoginReturn(value) {
    if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin || ["/login", "/register"].includes(url.pathname)) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
}
