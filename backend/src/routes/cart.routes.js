import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { isPositiveInteger, readCart } from "../lib/cart.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

function fail(message, status = 400) {
    throw Object.assign(new Error(message), { status });
}

router.get("/", async (req, res, next) => {
    try {
        res.json(await readCart(prisma, req.user.sub));
    } catch (error) { next(error); }
});

router.post("/items", async (req, res, next) => {
    try {
        const { productId, quantity } = req.body ?? {};
        if (!isPositiveInteger(productId)) fail("Product ID must be a positive integer.");
        if (!isPositiveInteger(quantity)) fail("Quantity must be a positive integer.");

        const cart = await prisma.$transaction(async (tx) => {
            const product = await tx.product.findUnique({ where: { id: productId } });
            if (!product) fail("Product not found", 404);
            if (product.archivedAt) fail("This product is archived and cannot be purchased.", 409);
            if (quantity > product.stock) fail(`Not enough stock for "${product.name}"`);

            const owner = await tx.cart.upsert({
                where: { userId: req.user.sub }, update: {}, create: { userId: req.user.sub },
            });
            const where = { cartId_productId: { cartId: owner.id, productId } };
            const existing = await tx.cartItem.findUnique({ where });
            const total = (existing?.quantity ?? 0) + quantity;
            if (!isPositiveInteger(total) || total > product.stock) fail(`Not enough stock for "${product.name}"`);
            await tx.cartItem.upsert({
                where, update: { quantity: total }, create: { cartId: owner.id, productId, quantity: total },
            });
            return readCart(tx, req.user.sub);
        });
        res.json(cart);
    } catch (error) { next(error); }
});

router.patch("/items/:productId", async (req, res, next) => {
    try {
        const productId = Number(req.params.productId);
        const { quantity } = req.body ?? {};
        if (!isPositiveInteger(productId)) fail("Product ID must be a positive integer.");
        if (!isPositiveInteger(quantity)) fail("Quantity must be a positive integer.");

        const cart = await prisma.$transaction(async (tx) => {
            const owner = await tx.cart.findUnique({ where: { userId: req.user.sub } });
            if (!owner) fail("Cart item not found", 404);
            const where = { cartId_productId: { cartId: owner.id, productId } };
            const item = await tx.cartItem.findUnique({ where, include: { product: true } });
            if (!item) fail("Cart item not found", 404);
            if (item.product.archivedAt) fail("This product is archived and cannot be purchased.", 409);
            if (quantity > item.product.stock) fail(`Not enough stock for "${item.product.name}"`);
            await tx.cartItem.update({ where, data: { quantity } });
            return readCart(tx, req.user.sub);
        });
        res.json(cart);
    } catch (error) { next(error); }
});

router.delete("/items/:productId", async (req, res, next) => {
    try {
        const productId = Number(req.params.productId);
        if (!isPositiveInteger(productId)) fail("Product ID must be a positive integer.");
        const cart = await prisma.$transaction(async (tx) => {
            const deleted = await tx.cartItem.deleteMany({
                where: { productId, cart: { userId: req.user.sub } },
            });
            if (!deleted.count) fail("Cart item not found", 404);
            return readCart(tx, req.user.sub);
        });
        res.json(cart);
    } catch (error) { next(error); }
});

router.delete("/", async (req, res, next) => {
    try {
        await prisma.cartItem.deleteMany({ where: { cart: { userId: req.user.sub } } });
        res.json({ items: [] });
    } catch (error) { next(error); }
});

export default router;
