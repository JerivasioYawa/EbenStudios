import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { checkoutKey, placeOrder, shippingAddress } from "../lib/checkout.js";
import { orderDto } from "../lib/serializers.js";

const router = Router();
const VALID_STATUSES = ["Pending", "Paid", "Shipped", "Delivered", "Cancelled"];

router.get("/", requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const orders = await prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } });
        res.json(orders.map(orderDto));
    } catch (error) { next(error); }
});

router.post("/", requireAuth, async (req, res, next) => {
    try {
        const key = checkoutKey(req.get("Idempotency-Key"));
        const address = shippingAddress(req.body?.shippingAddress);
        const { order, replayed } = await placeOrder(prisma, req.user, key, address);
        res.set("Idempotency-Replayed", String(replayed)).status(replayed ? 200 : 201).json(orderDto(order));
    } catch (error) { next(error); }
});

router.patch("/:id/status", requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ message: "Status must be one of: " + VALID_STATUSES.join(", ") });
        }
        const order = await prisma.order.update({
            where: { id: Number(req.params.id) }, data: { status }, include: { items: true },
        });
        res.json(orderDto(order));
    } catch (error) {
        if (error.code === "P2025") return res.status(404).json({ message: "Order not found" });
        next(error);
    }
});

router.get("/mine", requireAuth, async (req, res, next) => {
    try {
        const orders = await prisma.order.findMany({
            where: { userId: req.user.sub }, include: { items: true }, orderBy: { createdAt: "desc" },
        });
        res.json(orders.map(orderDto));
    } catch (error) { next(error); }
});

export default router;
