import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { isPositiveInteger } from "../lib/cart.js";

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
        const { shippingAddress } = req.body ?? {};

        const order = await prisma.$transaction(async (tx) => {
            const cart = await tx.cart.findUnique({
                where: { userId: req.user.sub },
                include: { items: { orderBy: { id: "asc" } } },
            });
            if (!cart?.items.length) {
                throw Object.assign(new Error("Cart is empty"), { status: 400 });
            }
            let total = 0;
            const orderItemsData = [];

            for (const { productId, quantity } of cart.items) {
                if (!isPositiveInteger(quantity)) {
                    throw Object.assign(new Error("Quantity must be a positive integer."), { status: 400 });
                }
                const product = await tx.product.findUnique({ where: { id: productId } });

                if (!product) {
                    throw Object.assign(new Error("A product in your cart no longer exists"), { status: 400 });
                }

                if (!Number.isFinite(product.price) || product.price < 0) {
                    throw Object.assign(new Error(`Price is unavailable for "${product.name}"`), { status: 400 });
                }

                const reserved = await tx.product.updateMany({
                    where: { id: product.id, stock: { gte: quantity } },
                    data: { stock: { decrement: quantity } },
                });
                if (reserved.count !== 1) {
                    throw Object.assign(new Error(`Not enough stock for "${product.name}"`), { status: 400 });
                }

                total += product.price * quantity;
                orderItemsData.push({ productId: product.id, quantity, price: product.price });
            }

            const created = await tx.order.create({
                data: {
                    userId: req.user.sub,
                    total,
                    shippingAddress,
                    items: { create: orderItemsData },
                },
                include: { items: { include: { product: true } } },
            });
            await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
            return created;
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
