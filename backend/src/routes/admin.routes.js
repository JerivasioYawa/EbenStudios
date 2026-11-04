import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { productDto, orderDto } from "../lib/serializers.js";
import { adminTransaction, choice, id, MAX_INT, pageResult, pagination, stockRecord, text } from "../lib/admin.js";
import { inputError } from "../lib/money.js";
import { changeFulfilment, dashboard, fulfilmentStatuses, orderDetails, paymentStatuses, recordPayment, updateShipping } from "../lib/order-management.js";

const router = Router();
router.use(requireAuth, requireAdmin);
router.use((req, res, next) => {
    if (["POST", "PATCH"].includes(req.method) && req.body === undefined) req.body = {};
    next();
});
router.get("/products", async (req, res, next) => {
    try {
        const paging = pagination(req.query);
        const status = choice(req.query.status, ["active", "archived", "all"], "active");
        const stock = choice(req.query.stock, ["all", "low", "out", "available"], "all");
        const q = text(req.query.q, "Search", 120);
        const tag = text(req.query.tag, "Tag", 80);
        const where = {
            ...(status === "all" ? {} : { archivedAt: status === "archived" ? { not: null } : null }),
            ...(q ? { OR: [{ name: { contains: q } }, { description: { contains: q } }] } : {}),
            ...(tag ? { tag } : {}),
            ...(stock === "low" ? { stock: { lte: prisma.product.fields.lowStockThreshold } } : stock === "out" ? { stock: 0 } : stock === "available" ? { stock: { gt: 0 } } : {}),
        };
        const [items, total] = await prisma.$transaction([
            prisma.product.findMany({ where, skip: paging.skip, take: paging.take, orderBy: { id: "desc" } }), prisma.product.count({ where }),
        ]);
        res.json(pageResult(items.map(productDto), total, paging));
    } catch (error) { next(error); }
});
router.patch("/products/:id/archive", async (req, res, next) => {
    try {
        const productId = id(req.params.id);
        if (typeof req.body.archived !== "boolean") throw inputError("Archived must be true or false.");
        const reason = text(req.body.reason, "Reason", 500, true);
        const product = await adminTransaction(req.user, req.body.archived ? "Product archived" : "Product restored", "Product", productId, reason, async tx => {
            const previous = await tx.product.findUnique({ where: { id: productId } });
            if (!previous) throw inputError("Product not found", 404);
            const saved = await tx.product.update({ where: { id: productId }, data: { archivedAt: req.body.archived ? (previous.archivedAt || new Date()) : null } });
            return { value: saved, before: previous, after: saved };
        });
        res.json(productDto(product));
    } catch (error) { next(error); }
});
router.post("/products/:id/stock-adjustments", async (req, res, next) => {
    try {
        const productId = id(req.params.id);
        const { delta } = req.body;
        if (!Number.isInteger(delta) || !delta || Math.abs(delta) > MAX_INT) throw inputError("Stock adjustment must be a nonzero whole number.");
        const reason = text(req.body.reason, "Stock adjustment reason", 500, true);
        const product = await adminTransaction(req.user, "Stock adjusted", "Product", productId, reason, async tx => {
            const previous = await tx.product.findUnique({ where: { id: productId } });
            if (!previous) throw inputError("Product not found", 404);
            if (previous.stock + delta < 0 || previous.stock + delta > MAX_INT) throw inputError("Stock adjustment would exceed valid stock bounds.", 409);
            await stockRecord(tx, req.user, previous, delta, reason);
            const saved = await tx.product.update({ where: { id: productId }, data: { stock: { increment: delta } } });
            return { value: saved, before: previous, after: saved };
        });
        res.json(productDto(product));
    } catch (error) { next(error); }
});
router.get("/products/:id/history", async (req, res, next) => {
    try {
        const productId = id(req.params.id), paging = pagination(req.query);
        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) throw inputError("Product not found", 404);
        const [stock, stockCount, audits, auditCount] = await prisma.$transaction([
            prisma.stockAdjustment.findMany({ where: { productId }, skip: paging.skip, take: paging.take, orderBy: { id: "desc" } }),
            prisma.stockAdjustment.count({ where: { productId } }),
            prisma.adminAudit.findMany({ where: { entityType: "Product", entityId: productId }, skip: paging.skip, take: paging.take, orderBy: { id: "desc" } }),
            prisma.adminAudit.count({ where: { entityType: "Product", entityId: productId } }),
        ]);
        res.json({ product: productDto(product), adjustments: pageResult(stock, stockCount, paging), audit: pageResult(audits, auditCount, paging) });
    } catch (error) { next(error); }
});
router.get("/audit", async (req, res, next) => {
    try {
        const paging = pagination(req.query);
        const entityType = choice(req.query.entityType, ["Product", "Order", "Invoice"]);
        const entityId = req.query.entityId === undefined ? undefined : id(req.query.entityId);
        const where = { entityType, entityId };
        const [items, total] = await prisma.$transaction([
            prisma.adminAudit.findMany({ where, skip: paging.skip, take: paging.take, orderBy: { id: "desc" } }), prisma.adminAudit.count({ where }),
        ]);
        res.json(pageResult(items, total, paging));
    } catch (error) { next(error); }
});
router.get("/orders", async (req, res, next) => {
    try {
        const paging = pagination(req.query), q = text(req.query.q, "Search", 120);
        const paymentStatus = choice(req.query.paymentStatus, paymentStatuses);
        const fulfilmentStatus = choice(req.query.fulfilmentStatus, fulfilmentStatuses);
        const orderId = q && /^(?:#?EB-)?\d+$/i.test(q) ? Number(q.replace(/^#?EB-/i, "")) : null;
        const where = { paymentStatus, fulfilmentStatus, ...(q ? { OR: [
            { customerName: { contains: q } }, { customerEmail: { contains: q } },
            { shippingAddress: { contains: q } }, { items: { some: { productName: { contains: q } } } },
            ...(Number.isInteger(orderId) && orderId > 0 && orderId <= MAX_INT ? [{ id: orderId }] : []),
        ] } : {}) };
        const [items, total] = await prisma.$transaction([
            prisma.order.findMany({ where, skip: paging.skip, take: paging.take, orderBy: { id: "desc" }, include: { items: true } }), prisma.order.count({ where }),
        ]);
        res.json(pageResult(items.map(orderDto), total, paging));
    } catch (error) { next(error); }
});
router.get("/orders/:id", async (req, res, next) => {
    try {
        const order = await prisma.order.findUnique({ where: { id: id(req.params.id) }, include: orderDetails });
        if (!order) throw inputError("Order not found", 404);
        res.json(orderDto(order));
    } catch (error) { next(error); }
});
for (const [method, path, handler] of [
    ["patch", "/orders/:id/fulfilment", (user, orderId, body) => changeFulfilment(user, orderId, body)],
    ["post", "/orders/:id/cancel", (user, orderId, body) => changeFulfilment(user, orderId, { ...body, fulfilmentStatus: "Cancelled" })],
    ["post", "/orders/:id/payments", (user, orderId, body) => recordPayment(user, orderId, body)],
    ["post", "/orders/:id/refunds", (user, orderId, body) => recordPayment(user, orderId, body, "Refund")],
    ["patch", "/orders/:id/shipping", updateShipping],
]) {
    router[method](path, async (req, res, next) => {
        try { res.json(orderDto(await handler(req.user, id(req.params.id), req.body))); }
        catch (error) { next(error); }
    });
}
router.get("/dashboard", async (req, res, next) => {
    try {
        const result = await dashboard();
        res.json({ ...result, recentOrders: result.recentOrders.map(orderDto), lowStock: result.lowStock.map(productDto) });
    } catch (error) { next(error); }
});
export default router;
