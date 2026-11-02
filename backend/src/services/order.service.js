import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { validateId, validateOrder, validateOrderStatus, validationError } from "../lib/validation.js";
import { addLineTotal } from "../lib/money.js";
const STATUSES = ["Pending", "Paid", "Shipped", "Delivered", "Cancelled"];
const NEXT = { Pending: ["Paid", "Cancelled"], Paid: ["Shipped"], Shipped: ["Delivered"], Delivered: [], Cancelled: [] };
const INCLUDE = { user: { select: { id: true, name: true, email: true } }, items: { include: { product: true } } };
function fail(status, message) { return Object.assign(new Error(message), { status }); }
function key(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) throw validationError("A valid Idempotency-Key header is required.");
    return value;
}
function hash(userId, items, shippingAddress) {
    // Same canonical format as Phase 3, so existing checkout references still work.
    return createHash("sha256").update(JSON.stringify({ userId, items: [...items].sort((a,b) => a.productId-b.productId), shippingAddress })).digest("hex");
}
function replay(order, userId, requestHash) {
    if (order.userId !== userId || order.requestHash !== requestHash) throw fail(409, "This checkout reference was already used for a different request.");
    return { order, replayed: true };
}
async function transaction(work) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try { return await prisma.$transaction(work, { maxWait: 5000, timeout: 10000 }); }
        catch (error) {
            if (error.code === "P2034" && attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, attempt * 100));
                continue;
            }
            throw error;
        }
    }
}
function transactionError(error) {
    if (["P2034", "P1008", "P2028"].includes(error.code)) throw fail(409, "The database is busy. Retry the same request without changing its checkout reference.");
    throw error;
}
export async function createOrder(authenticatedUserId, body, rawKey) {
    const userId = validateId(authenticatedUserId, "User ID");
    const { items, shippingAddress } = validateOrder(body);
    const idempotencyKey = key(rawKey);
    const requestHash = hash(userId, items, shippingAddress);
    try {
        return await transaction(async tx => {
            const existing = await tx.order.findUnique({ where: { idempotencyKey }, include: INCLUDE });
            if (existing) return replay(existing, userId, requestHash);
            let totalCents = 0;
            const orderItems = [];
            for (const { productId, quantity } of [...items].sort((a,b) => a.productId-b.productId)) {
                const product = await tx.product.findUnique({ where: { id: productId } });
                if (!product || !product.isActive) throw fail(409, "A product in your cart is no longer available.");
                const changed = await tx.product.updateMany({
                    where: { id: productId, isActive: true, stock: { gte: quantity } },
                    data: { stock: { decrement: quantity } },
                });
                if (changed.count !== 1) throw fail(409, `Not enough stock for "${product.name}" or product no longer available.`);
                totalCents = addLineTotal(totalCents, product.priceCents, quantity);
                orderItems.push({ productId, quantity, unitPriceCents: product.priceCents, productName: product.name });
            }
            const order = await tx.order.create({
                data: { userId, totalCents, shippingAddress, status: "Pending", idempotencyKey, requestHash, stockRestored: false, items: { create: orderItems } },
                include: INCLUDE,
            });
            return { order, replayed: false };
        });
    } catch (error) {
        if (["P2002", "P2034", "P1008", "P2028"].includes(error.code)) {
            const existing = await prisma.order.findUnique({ where: { idempotencyKey }, include: INCLUDE });
            if (existing) return replay(existing, userId, requestHash);
        }
        transactionError(error);
    }
}
export async function changeOrderStatus(rawId, body) {
    const id = validateId(rawId, "Order ID");
    const status = validateOrderStatus(body, STATUSES);
    try {
        return await transaction(async tx => {
            const order = await tx.order.findUnique({ where: { id }, include: INCLUDE });
            if (!order) throw fail(404, "Order not found.");
            if (order.status === status) return order;
            if (!(NEXT[order.status] || []).includes(status)) throw fail(409, `An order cannot move from ${order.status} to ${status}.`);
            const cancelling = status === "Cancelled";
            if (cancelling && order.stockRestored) throw fail(409, "Inconsistent stock-restoration state.");
            if (cancelling && order.items.some(item => !Number.isSafeInteger(item.quantity) || item.quantity < 1)) throw fail(409, "Order requires manual quantity review.");
            const changed = await tx.order.updateMany({
                where: { id, status: order.status, ...(cancelling ? { stockRestored: false } : {}) },
                data: { status, ...(cancelling ? { stockRestored: true } : {}) },
            });
            if (changed.count !== 1) throw fail(409, "The order changed during this request. Refresh and retry.");
            if (cancelling) {
                // Archived products still exist and receive their returned stock.
                for (const item of order.items) await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
            }
            return tx.order.findUnique({ where: { id }, include: INCLUDE });
        });
    } catch (error) { transactionError(error); }
}
