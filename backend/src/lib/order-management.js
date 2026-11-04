import { prisma } from "./prisma.js";
import { inputError } from "./money.js";
import { actorData, adminTransaction, choice, integer, MAX_INT, stockRecord, text } from "./admin.js";
import { voidInvoicesForCancellation } from "./invoices.js";

export const paymentStatuses = ["Pending", "Unverified", "Confirmed", "RefundRequired", "Refunded"];
export const fulfilmentStatuses = ["Unfulfilled", "Processing", "Shipped", "Delivered", "Cancelled"];
export const orderDetails = { items: true, payments: { orderBy: { id: "asc" } }, history: { orderBy: { id: "asc" } } };
const transitions = { Unfulfilled: ["Processing", "Cancelled"], Processing: ["Shipped", "Cancelled"], Shipped: ["Delivered"], Delivered: [], Cancelled: [] };
function summary(order) {
    return Object.fromEntries(["status", "paymentStatus", "fulfilmentStatus", "shippingReference", "stockRestoredAt", "totalCents"].map(key => [key, order[key]]));
}
function legacyStatus(payment, fulfilment) {
    return fulfilment === "Unfulfilled" ? (payment === "Confirmed" ? "Paid" : "Pending") : fulfilment;
}
async function event(tx, user, orderId, type, fromStatus, toStatus, note) {
    await tx.orderEvent.create({ data: { ...actorData(user), orderId, type, fromStatus, toStatus, note } });
}
async function load(tx, orderId) {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: orderDetails });
    if (!order) throw inputError("Order not found", 404);
    return order;
}

export async function changeFulfilment(user, orderId, body) {
    const target = choice(body.fulfilmentStatus, fulfilmentStatuses);
    if (!target) throw inputError("Fulfilment status is required.");
    const reason = text(body.reason, "Reason", 500, target === "Cancelled");
    const reference = text(body.shippingReference, "Shipping reference", 200);
    return adminTransaction(user, target === "Cancelled" ? "Order cancelled" : "Fulfilment changed", "Order", orderId, reason, async tx => {
        const order = await load(tx, orderId);
        if (target === "Cancelled" && order.fulfilmentStatus === "Cancelled") {
            return { value: order, before: summary(order), after: summary(order) };
        }
        if (!transitions[order.fulfilmentStatus]?.includes(target)) throw inputError("This fulfilment transition is not allowed.", 409);
        if (target !== "Cancelled" && order.paymentStatus !== "Confirmed") throw inputError("Confirm payment before fulfilling this order.", 409);
        if (target === "Shipped" && !(reference || order.shippingReference)) throw inputError("A shipping reference is required before shipping.");
        let paymentStatus = order.paymentStatus;
        let stockRestoredAt = order.stockRestoredAt;
        if (target === "Cancelled") {
            if (!stockRestoredAt) {
                const quantities = new Map();
                for (const item of order.items) {
                    if (!item.productId) throw inputError("An ordered product no longer exists. Resolve its stock before cancelling.", 409);
                    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
                }
                for (const [productId, quantity] of quantities) {
                    const product = await tx.product.findUnique({ where: { id: productId } });
                    if (!product || !Number.isSafeInteger(quantity) || product.stock + quantity > MAX_INT) {
                        throw inputError("Stock cannot be safely restored. Review this order before cancelling.", 409);
                    }
                    await tx.product.update({ where: { id: productId }, data: { stock: { increment: quantity } } });
                    await stockRecord(tx, user, product, quantity, reason, "Cancellation", orderId);
                }
                stockRestoredAt = new Date();
            }
            if (paymentStatus === "Confirmed") paymentStatus = "RefundRequired";
            await voidInvoicesForCancellation(tx, user, orderId, reason);
        }
        const saved = await tx.order.update({ where: { id: orderId }, data: {
            fulfilmentStatus: target, paymentStatus, stockRestoredAt,
            shippingReference: reference || undefined, status: legacyStatus(paymentStatus, target),
        } });
        await event(tx, user, orderId, target === "Cancelled" ? "Order cancelled" : "Fulfilment changed", order.fulfilmentStatus, target, reason || reference);
        return { value: await load(tx, orderId), before: summary(order), after: summary(saved) };
    });
}

export async function recordPayment(user, orderId, body, kind = "Confirmation") {
    const reference = text(body.reference, "Payment reference", 200, true);
    const amountCents = integer(body.amountCents, "Payment amount in cents");
    const note = text(body.note, "Payment note", 500);
    return adminTransaction(user, kind === "Refund" ? "Refund recorded" : "Payment confirmed", "Order", orderId, note, async tx => {
        const order = await load(tx, orderId);
        const existing = order.payments.find(payment => payment.kind === kind);
        if (existing) {
            if (existing.reference !== reference || existing.amountCents !== amountCents) throw inputError("This order already has a different payment record.", 409);
            return { value: order, before: summary(order), after: summary(order) };
        }
        if (amountCents !== order.totalCents) throw inputError("The payment record must match the full order amount.");
        if (kind === "Confirmation") {
            if (order.fulfilmentStatus === "Cancelled" || !["Pending", "Unverified"].includes(order.paymentStatus)) {
                throw inputError("Payment cannot be confirmed for this order.", 409);
            }
        } else if (order.fulfilmentStatus !== "Cancelled" || order.paymentStatus !== "RefundRequired") {
            throw inputError("A refund can only be recorded for a cancelled, confirmed payment.", 409);
        }
        await tx.paymentRecord.create({ data: { ...actorData(user), orderId, kind, amountCents, reference, note } });
        const paymentStatus = kind === "Refund" ? "Refunded" : "Confirmed";
        const saved = await tx.order.update({ where: { id: orderId }, data: { paymentStatus, status: legacyStatus(paymentStatus, order.fulfilmentStatus) } });
        await event(tx, user, orderId, kind === "Refund" ? "Refund recorded" : "Payment confirmed", order.paymentStatus, paymentStatus, reference);
        return { value: await load(tx, orderId), before: summary(order), after: summary(saved) };
    });
}

export async function updateShipping(user, orderId, body) {
    const reference = text(body.shippingReference, "Shipping reference", 200, true);
    const reason = text(body.reason, "Reason", 500, true);
    return adminTransaction(user, "Shipping reference updated", "Order", orderId, reason, async tx => {
        const order = await load(tx, orderId);
        if (!["Processing", "Shipped"].includes(order.fulfilmentStatus)) throw inputError("Shipping details can only change while processing or shipped.", 409);
        const saved = await tx.order.update({ where: { id: orderId }, data: { shippingReference: reference } });
        await event(tx, user, orderId, "Shipping reference updated", order.shippingReference, reference, reason);
        return { value: await load(tx, orderId), before: summary(order), after: summary(saved) };
    });
}

export async function dashboard() {
    return prisma.$transaction(async tx => {
        const payments = await tx.paymentRecord.findMany({ include: { order: { select: { paymentStatus: true, fulfilmentStatus: true } } } });
        const sum = predicate => payments.filter(predicate).reduce((total, row) => total + BigInt(row.amountCents), 0n).toString();
        const [orders, products, archivedProducts, customers, recentOrders, lowStock] = await Promise.all([
            tx.order.count(), tx.product.count({ where: { archivedAt: null } }), tx.product.count({ where: { archivedAt: { not: null } } }),
            tx.order.findMany({ distinct: ["userId"], select: { userId: true } }),
            tx.order.findMany({ take: 5, orderBy: { id: "desc" }, include: { items: true } }),
            tx.product.findMany({ where: { archivedAt: null, stock: { lte: prisma.product.fields.lowStockThreshold } }, orderBy: [{ stock: "asc" }, { id: "asc" }], take: 10 }),
        ]);
        return { orders, products, archivedProducts, customers: customers.length, recentOrders, lowStock,
            confirmedPaymentsCents: sum(row => row.kind === "Confirmation" && row.order.paymentStatus === "Confirmed" && row.order.fulfilmentStatus !== "Cancelled"),
            awaitingRefundCents: sum(row => row.kind === "Confirmation" && row.order.paymentStatus === "RefundRequired"),
            refundedCents: sum(row => row.kind === "Refund"),
            pendingOrders: await tx.order.count({ where: { paymentStatus: "Pending", fulfilmentStatus: { not: "Cancelled" } } }),
            unverifiedOrders: await tx.order.count({ where: { paymentStatus: "Unverified" } }),
        };
    });
}
