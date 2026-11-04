import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { productDto } from "../lib/serializers.js";

const router = Router();
router.use(requireAuth);

function parseProductId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647 ? id : null;
}

router.get("/", async (req, res, next) => {
    try {
        const likes = await prisma.productLike.findMany({
            where: { userId: req.user.sub, product: { archivedAt: null } },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            include: { product: true },
        });
        res.json(likes.map(({ product }) => productDto(product)));
    } catch (error) { next(error); }
});

router.put("/:productId", async (req, res, next) => {
    try {
        const productId = parseProductId(req.params.productId);
        if (!productId) return res.status(400).json({ message: "Product ID must be a positive integer." });
        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) return res.status(404).json({ message: "Product not found" });

        const where = { userId_productId: { userId: req.user.sub, productId } };
        try {
            await prisma.productLike.upsert({ where, update: {}, create: { userId: req.user.sub, productId } });
        } catch (error) {
            // Concurrent client-side upserts can race. The unique pair is the final authority.
            if (error.code !== "P2002" || !(await prisma.productLike.findUnique({ where }))) throw error;
        }
        res.json(productDto(product));
    } catch (error) {
        if (error.code === "P2003") return res.status(404).json({ message: "Product is no longer available" });
        next(error);
    }
});

router.delete("/:productId", async (req, res, next) => {
    try {
        const productId = parseProductId(req.params.productId);
        if (!productId) return res.status(400).json({ message: "Product ID must be a positive integer." });
        await prisma.productLike.deleteMany({ where: { userId: req.user.sub, productId } });
        res.status(204).end();
    } catch (error) { next(error); }
});

export default router;
