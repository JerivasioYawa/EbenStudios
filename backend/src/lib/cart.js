import { productDto } from "./serializers.js";

export function isPositiveInteger(value) {
    return Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647;
}

export async function readCart(client, userId) {
    const cart = await client.cart.findUnique({
        where: { userId },
        include: { items: { orderBy: { id: "asc" }, include: { product: true } } },
    });
    return { items: cart?.items.map(({ product, quantity }) => ({ ...productDto(product), quantity })) ?? [] };
}
