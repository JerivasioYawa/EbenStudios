import { centsToRand } from "./money.js";
export function presentProduct(product) {
    if (!product) return null;
    return { ...product, price: centsToRand(product.priceCents) };
}
export function presentOrder(order) {
    if (!order) return null;
    return {
        ...order,
        total: centsToRand(order.totalCents),
        items: (order.items || []).map((item) => ({
            ...item,
            price: centsToRand(item.unitPriceCents),
            // Existing UI reads item.product.name. Preserve purchase-time naming.
            // The product identifier still refers to the original catalogue record.
            product: item.product ? {
                ...presentProduct(item.product), name: item.productName,
            } : { id: item.productId, name: item.productName },
        })),
    };
}
