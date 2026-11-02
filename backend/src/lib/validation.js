import { randToCents } from "./money.js";
export function validationError(message) { return Object.assign(new Error(message), { status: 400 }); }
function requireObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw validationError("Request body must be an object.");
    return value;
}
function requiredText(value, field, maximum) {
    if (typeof value !== "string") throw validationError(`${field} must be text.`);
    const result = value.trim();
    if (!result) throw validationError(`${field} is required.`);
    if (result.length > maximum) throw validationError(`${field} must not exceed ${maximum} characters.`);
    return result;
}
function optionalText(value, field, maximum) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") throw validationError(`${field} must be text.`);
    if (!value.trim()) return null;
    return requiredText(value, field, maximum);
}
function wholeNumber(value, field, minimum, maximum) {
    let parsed = value;
    if (typeof value === "string" && /^\d+$/.test(value)) parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
        throw validationError(`${field} must be a whole number from ${minimum} to ${maximum}.`);
    }
    return parsed;
}
export function validateId(value, field = "ID") { return wholeNumber(value, field, 1, 2_147_483_647); }
export function validateProduct(body, { partial = false } = {}) {
    requireObject(body);
    const data = {};
    if (!partial || body.name !== undefined) data.name = requiredText(body.name, "Product name", 150);
    if (!partial || body.price !== undefined) data.priceCents = randToCents(body.price);
    if (!partial || body.stock !== undefined) data.stock = wholeNumber(body.stock, "Stock", 0, 1_000_000);
    if (body.description !== undefined) data.description = optionalText(body.description, "Description", 3000);
    if (body.tag !== undefined) data.tag = optionalText(body.tag, "Tag", 50);
    return data;
}
export function validateOrder(body) {
    requireObject(body);
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) {
        throw validationError("An order must contain between 1 and 100 cart lines.");
    }
    const quantities = new Map();
    for (const item of body.items) {
        requireObject(item);
        const productId = validateId(item.productId, "Product ID");
        const quantity = wholeNumber(item.quantity, "Quantity", 1, 100);
        const combined = (quantities.get(productId) || 0) + quantity;
        if (combined > 100) throw validationError("Each product is limited to 100 units per order.");
        quantities.set(productId, combined);
    }
    return {
        items: Array.from(quantities, ([productId, quantity]) => ({ productId, quantity })),
        shippingAddress: requiredText(body.shippingAddress, "Shipping address", 500),
    };
}
function email(value) {
    const result = requiredText(value, "Email", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw validationError("Enter a valid email address.");
    return result;
}
function password(value, registration = false) {
    if (typeof value !== "string" || !value.length) throw validationError("Password is required.");
    if (Buffer.byteLength(value, "utf8") > 72) throw validationError("Password must not exceed 72 UTF-8 bytes.");
    if (registration && value.length < 12) throw validationError("New passwords must contain at least 12 characters.");
    return value;
}
export function validateRegistration(body) {
    requireObject(body);
    return { name: requiredText(body.name, "Name", 100), email: email(body.email), password: password(body.password, true) };
}
export function validateLogin(body) {
    requireObject(body);
    return { email: email(body.email), password: password(body.password) };
}
export function validateOrderStatus(body, allowed) {
    requireObject(body);
    if (typeof body.status !== "string" || !allowed.includes(body.status)) {
        throw validationError(`Status must be one of: ${allowed.join(", ")}.`);
    }
    return body.status;
}
