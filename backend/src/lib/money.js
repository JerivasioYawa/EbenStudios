export const MAX_CENTS = 2_147_483_647;

export function inputError(message, status = 400) {
    return Object.assign(new Error(message), { status });
}

export function parsePriceCents(value) {
    if (!["string", "number"].includes(typeof value)) throw inputError("Price must have at most two decimal places.");
    const text = String(value).trim();
    const match = text.length <= 32 && /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
    if (!match) throw inputError("Price must be a non-negative amount with at most two decimal places.");
    const cents = BigInt(match[1]) * 100n + BigInt((match[2] || "").padEnd(2, "0"));
    if (cents > BigInt(MAX_CENTS)) throw inputError("Price exceeds the supported amount.");
    return Number(cents);
}

export function lineTotalCents(unitPriceCents, quantity) {
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 2_147_483_647) throw inputError("Quantity must be a positive integer.");
    if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0 || unitPriceCents > MAX_CENTS) throw inputError("Product price is unavailable.");
    const total = BigInt(unitPriceCents) * BigInt(quantity);
    if (total > BigInt(MAX_CENTS)) throw inputError("Order total exceeds the supported amount.");
    return Number(total);
}

export function addCents(left, right) {
    const total = left + right;
    if (!Number.isSafeInteger(total) || total > MAX_CENTS) throw inputError("Order total exceeds the supported amount.");
    return total;
}
