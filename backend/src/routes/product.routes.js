import { Router } from "express";
import fs from "node:fs/promises";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { upload, verifyImage, deleteLocalUpload } from "../middleware/upload.js";
import { validateId, validateProduct } from "../lib/validation.js";
import { presentProduct } from "../lib/presenters.js";
const router = Router();
function imageUrl(req) { return req.file ? `${process.env.PUBLIC_API_ORIGIN || `${req.protocol}://${req.get("host")}`}/uploads/${req.file.filename}` : undefined; }
async function removeFailedUpload(req) {
    if (!req.file) return;
    try { await fs.unlink(req.file.path); }
    catch (error) { if (error.code !== "ENOENT") console.error("Unused upload cleanup failed", error); }
}
router.get("/", async (req, res, next) => {
    try { res.json((await prisma.product.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } })).map(presentProduct)); }
    catch (error) { next(error); }
});
// Keep this fixed path before /:id.
router.get("/archived", requireAuth, requireAdmin, async (req, res, next) => {
    try { res.json((await prisma.product.findMany({ where: { isActive: false }, orderBy: { createdAt: "desc" } })).map(presentProduct)); }
    catch (error) { next(error); }
});
router.get("/:id", async (req, res, next) => {
    try {
        const id = validateId(req.params.id, "Product ID");
        const product = await prisma.product.findUnique({ where: { id } });
        if (!product || !product.isActive) return res.status(404).json({ message: "Product not found." });
        res.json(presentProduct(product));
    } catch (error) { next(error); }
});
router.post("/", requireAuth, requireAdmin, upload.single("image"), verifyImage, async (req, res, next) => {
    let saved = false;
    try {
        const data = validateProduct(req.body);
        const product = await prisma.product.create({ data: { ...data, imageUrl: imageUrl(req), isActive: true } });
        saved = true;
        res.status(201).json(presentProduct(product));
    } catch (error) { if (!saved) await removeFailedUpload(req); next(error); }
});
router.put("/:id", requireAuth, requireAdmin, upload.single("image"), verifyImage, async (req, res, next) => {
    let saved = false;
    try {
        const id = validateId(req.params.id, "Product ID");
        const data = validateProduct(req.body, { partial: true });
        const previous = await prisma.product.findUnique({ where: { id } });
        if (!previous) { await removeFailedUpload(req); return res.status(404).json({ message: "Product not found." }); }
        const replacement = imageUrl(req);
        const product = await prisma.product.update({ where: { id }, data: { ...data, imageUrl: replacement } });
        saved = true;
        if (replacement && previous.imageUrl) deleteLocalUpload(previous.imageUrl);
        res.json(presentProduct(product));
    } catch (error) { if (!saved) await removeFailedUpload(req); next(error); }
});
// DELETE now archives: preserve the product and its image for order history.
router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const id = validateId(req.params.id, "Product ID");
        await prisma.product.update({ where: { id }, data: { isActive: false } });
        res.status(204).end();
    } catch (error) { next(error); }
});
router.patch("/:id/restore", requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const id = validateId(req.params.id, "Product ID");
        res.json(presentProduct(await prisma.product.update({ where: { id }, data: { isActive: true } })));
    } catch (error) { next(error); }
});
export default router;
