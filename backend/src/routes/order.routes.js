import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { createOrder, changeOrderStatus } from "../services/order.service.js";
import { presentOrder } from "../lib/presenters.js";
const router = Router();
router.get("/", requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const orders = await prisma.order.findMany({ include: { user: { select: { id: true, name: true, email: true } }, items: { include: { product: true } } }, orderBy: { createdAt: "desc" } });
        res.json(orders.map(presentOrder));
    } catch (error) { next(error); }
});
router.get("/mine", requireAuth, async (req, res, next) => {
    try {
        const orders = await prisma.order.findMany({ where: { userId: req.user.sub }, include: { items: { include: { product: true } } }, orderBy: { createdAt: "desc" } });
        res.json(orders.map(presentOrder));
    } catch (error) { next(error); }
});
router.post("/", requireAuth, async (req, res, next) => {
    try {
        const result = await createOrder(req.user.sub, req.body, req.get("Idempotency-Key"));
        res.set("Idempotency-Replayed", String(result.replayed));
        res.status(result.replayed ? 200 : 201).json(presentOrder(result.order));
    } catch (error) { next(error); }
});
router.patch("/:id/status", requireAuth, requireAdmin, async (req, res, next) => {
    try { res.json(presentOrder(await changeOrderStatus(req.params.id, req.body))); }
    catch (error) { next(error); }
});
export default router;
