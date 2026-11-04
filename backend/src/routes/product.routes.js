import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { upload, saveValidatedImage, deleteLocalUpload, removeUnusedImage } from "../middleware/upload.js";
import { inputError, parsePriceCents } from "../lib/money.js";
import { productDto } from "../lib/serializers.js";
import { adminTransaction, id, integer, stockRecord, text } from "../lib/admin.js";

const router = Router();
function productInput(body = {}, creating) {
    const data = {};
    if (creating || body.name !== undefined) data.name = text(body.name, "Name", 120, true);
    for (const [key, max] of [["description", 5000], ["tag", 80]]) {
        if (body[key] !== undefined) data[key] = text(body[key], key, max);
    }
    if (creating || body.price !== undefined) data.priceCents = parsePriceCents(body.price);
    if (creating || body.stock !== undefined) data.stock = integer(body.stock === undefined ? 0 : body.stock, "Stock");
    if (body.lowStockThreshold !== undefined) data.lowStockThreshold = integer(body.lowStockThreshold, "Low stock threshold");
    return data;
}
router.get("/", async (req, res, next) => {
    try {
        const products = await prisma.product.findMany({ where: { archivedAt: null }, orderBy: { createdAt: "desc" } });
        res.json(products.map(productDto));
    } catch (error) { next(error); }
});
router.get("/:id", async (req, res, next) => {
    try {
        const product = await prisma.product.findUnique({ where: { id: Number(req.params.id) } });
        if (!product || product.archivedAt) return res.status(404).json({ message: "Product not found" });
        res.json(productDto(product));
    } catch (error) { next(error); }
});
router.post("/", requireAuth, requireAdmin, upload.single("image"), async (req, res, next) => {
    let imageUrl;
    try {
        const data = productInput(req.body, true);
        imageUrl = await saveValidatedImage(req);
        const saved = await adminTransaction(req.user, "Product created", "Product", 0, "Initial product setup", async tx => {
            const product = await tx.product.create({ data: { ...data, imageUrl } });
            if (product.stock) await stockRecord(tx, req.user, { ...product, stock: 0 }, product.stock, "Initial stock on creation", "Initial");
            return { value: product, entityId: product.id, after: product };
        });
        res.status(201).json(productDto(saved));
    } catch (error) { await deleteLocalUpload(imageUrl); next(error); }
});
router.put("/:id", requireAuth, requireAdmin, upload.single("image"), async (req, res, next) => {
    let imageUrl, committed = false;
    try {
        const productId = id(req.params.id);
        const data = productInput(req.body, false);
        imageUrl = await saveValidatedImage(req);
        const result = await adminTransaction(req.user, "Product edited", "Product", productId, undefined, async tx => {
            const previous = await tx.product.findUnique({ where: { id: productId } });
            if (!previous) throw inputError("Product not found", 404);
            if (data.stock !== undefined && data.stock !== previous.stock) {
                const reason = text(req.body.stockReason, "Stock adjustment reason", 500, true);
                await stockRecord(tx, req.user, previous, data.stock - previous.stock, reason);
            }
            const product = await tx.product.update({ where: { id: productId }, data: { ...data, imageUrl } });
            return { value: { product, oldImage: previous.imageUrl }, before: previous, after: product };
        });
        committed = true;
        if (imageUrl) await removeUnusedImage(prisma, result.oldImage);
        res.json(productDto(result.product));
    } catch (error) { if (!committed) await deleteLocalUpload(imageUrl); next(error); }
});
router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const productId = id(req.params.id);
        const product = await adminTransaction(req.user, "Product deleted", "Product", productId, undefined, async tx => {
            const previous = await tx.product.findUnique({ where: { id: productId } });
            if (!previous) throw inputError("Product not found", 404);
            if (await tx.orderItem.count({ where: { productId } })) throw inputError("This product has order history. Archive it instead.", 409);
            await tx.product.delete({ where: { id: productId } });
            return { value: previous, before: previous };
        });
        await removeUnusedImage(prisma, product.imageUrl);
        res.status(204).end();
    } catch (error) { next(error); }
});
export default router;
