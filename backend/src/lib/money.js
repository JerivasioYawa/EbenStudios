export const MAX_DATABASE_INT = 2_147_483_647;
export const MAX_PRODUCT_CENTS = 100_000_000;
function bad(message) { return Object.assign(new Error(message), { status: 400 }); }
// Parse decimal text by digits. Do not multiply a floating-point price by 100.
export function randToCents(value) {
    if (typeof value !== "number" && typeof value !== "string") {
        throw bad("Price must be a valid amount.");
    }
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
    if (!match) throw bad("Price must be non-negative with at most two decimal places.");
    const cents = BigInt(match[1]) * 100n + BigInt((match[2] || "").padEnd(2, "0"));
    if (cents > BigInt(MAX_PRODUCT_CENTS)) throw bad("Price must not exceed R 1000000.");
    return Number(cents);
}
// Display/API compatibility only. All authoritative calculations use integer cents.
export function centsToRand(cents) {
    if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Invalid stored monetary amount.");
    return cents / 100;
}
export function addLineTotal(total, unitPriceCents, quantity) {
    if (!Number.isSafeInteger(total) || total < 0 ||
        !Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0 ||
        !Number.isSafeInteger(quantity) || quantity < 1) throw bad("Invalid order amount or quantity.");
    const result = total + unitPriceCents * quantity;
    if (!Number.isSafeInteger(result) || result > MAX_DATABASE_INT) {
        throw bad("Order total exceeds the supported maximum of R 21474836.47.");
    }
    return result;
}
