export function formatMoney(cents) {
    const value = BigInt(cents);
    const amount = value < 0n ? -value : value;
    return (value < 0n ? "-" : "") + "R " + (amount / 100n).toLocaleString("en-US")
        + "." + (amount % 100n).toString().padStart(2, "0");
}

export function cartLineCents(item) {
    return BigInt(item.priceCents) * BigInt(item.quantity);
}

export function cartSubtotalCents(items) {
    return items.reduce((sum, item) => sum + cartLineCents(item), 0n);
}
