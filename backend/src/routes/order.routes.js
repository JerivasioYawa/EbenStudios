import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

const VALID_STATUSES = ["Pending", "Paid", "Shipped", "Delivered", "Cancelled"];

router.get("/", requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const orders = await prisma.order.findMany({
            include: {
                user: { select: { id: true, name: true, email: true } },
                items: { include: { product: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json(orders);
    } catch (err) {
        next(err);
    }
});

router.post("/", requireAuth, async (req, res, next) => {
    try {
        const { items, shippingAddress } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        const order = await prisma.$transaction(async (tx) => {
            let total = 0;
            const orderItemsData = [];

            for (const { productId, quantity } of items) {
                const product = await tx.product.findUnique({ where: { id: Number(productId) } });

                if (!product) {
                    throw Object.assign(new Error("A product in your cart no longer exists"), { status: 400 });
                }

                if (product.stock < quantity) {
                    throw Object.assign(new Error(`Not enough stock for "${product.name}"`), { status: 400 });
                }

                await tx.product.update({
                    where: { id: product.id },
                    data: { stock: { decrement: quantity } },
                });

                total += product.price * quantity;
                orderItemsData.push({ productId: product.id, quantity, price: product.price });
            }

            return tx.order.create({
                data: {
                    userId: req.user.sub,
                    total,
                    shippingAddress,
                    items: { create: orderItemsData },
                },
                include: { items: { include: { product: true } } },
            });
        });

        res.status(201).json(order);
    } catch (err) {
        next(err);
    }
});

router.patch("/:id/status", requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const { status } = req.body;

        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ message: `Status must be one of: ${VALID_STATUSES.join(", ")}` });
        }

        const order = await prisma.order.update({
            where: { id: Number(req.params.id) },
            data: { status },
            include: {
                user: { select: { id: true, name: true, email: true } },
                items: { include: { product: true } },
            },
        });

        res.json(order);
    } catch (err) {
        if (err.code === "P2025") {
            return res.status(404).json({ message: "Order not found" });
        }

        next(err);
    }
});

router.get("/mine", requireAuth, async (req, res, next) => {
    try {
        const orders = await prisma.order.findMany({
            where: { userId: req.user.sub },
            include: { items: { include: { product: true } } },
            orderBy: { createdAt: "desc" },
        });

        res.json(orders);
    } catch (err) {
        next(err);
    }
});

export default router;
