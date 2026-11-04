import { addCents, inputError, lineTotalCents } from "./money.js";

export function checkoutKey(value) {
    if (typeof value !== "string" || !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(value)) {
        throw inputError("A UUID Idempotency-Key header is required for checkout.");
    }
    return value.toLowerCase();
}

export function shippingAddress(value) {
    if (value == null || value === "") return null;
    if (typeof value !== "string" || value.length > 2000) throw inputError("Shipping address is invalid.");
    return value.trim() || null;
}

function replay(order, address) {
    if (order.shippingAddress !== address) throw inputError("This checkout key was already used with different shipping details.", 409);
    return { order, replayed: true };
}

function transient(error) {
    return ["P1008", "P2034", "P2028"].includes(error.code)
        || (error.code === "P2010" && /locked|busy/i.test(JSON.stringify(error.meta)))
        || /SQLITE_BUSY|database is locked/i.test(error.message || "");
}

export async function placeOrder(client, user, key, address) {
    const where = { userId_idempotencyKey: { userId: user.sub, idempotencyKey: key } };
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const existing = await client.order.findUnique({ where, include: { items: true } });
            if (existing) return replay(existing, address);
            const order = await client.$transaction(async tx => {
                // Write first: SQLite obtains its writer lock before reading the cart/stock.
                // This durable claim is rolled back with every other write if checkout fails.
                const claim = await tx.order.create({ data: {
                    userId: user.sub, idempotencyKey: key, totalCents: 0,
                    customerName: user.name, customerEmail: user.email, shippingAddress: address,
                } });
                const cart = await tx.cart.findUnique({
                    where: { userId: user.sub }, include: { items: { orderBy: { id: "asc" } } },
                });
                if (!cart?.items.length) throw inputError("Cart is empty");
                let totalCents = 0;
                const items = [];
                for (const { productId, quantity } of cart.items) {
                    const product = await tx.product.findUnique({ where: { id: productId } });
                    if (!product) throw inputError("A product in your cart no longer exists");
                    if (product.archivedAt) throw inputError(`"${product.name}" is archived and cannot be purchased.`, 409);
                    const line = lineTotalCents(product.priceCents, quantity);
                    totalCents = addCents(totalCents, line);
                    const changed = await tx.product.updateMany({
                        where: { id: productId, stock: { gte: quantity } }, data: { stock: { decrement: quantity } },
                    });
                    if (changed.count !== 1) throw inputError(`Not enough stock for "${product.name}"`, 409);
                    items.push({ productId, quantity, unitPriceCents: product.priceCents, lineTotalCents: line,
                        productName: product.name, productDescription: product.description, productImageUrl: product.imageUrl });
                }
                const saved = await tx.order.update({
                    where: { id: claim.id }, data: { totalCents, items: { create: items }, history: { create: {
                        actorId: user.sub, actorName: user.name, actorEmail: user.email,
                        type: "Created", toStatus: "Unfulfilled", note: "Order placed by customer",
                    } } }, include: { items: true },
                });
                await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
                return saved;
            }, { maxWait: 10_000, timeout: 10_000 });
            return { order, replayed: false };
        } catch (error) {
            if (error.code === "P2002") {
                const existing = await client.order.findUnique({ where, include: { items: true } });
                if (existing) return replay(existing, address);
            }
            if (!transient(error)) throw error;
            if (attempt === 4) throw inputError("Checkout is busy. Please try again with the same checkout key.", 503);
            await new Promise(resolve => setTimeout(resolve, 20 * 2 ** attempt));
        }
    }
}
