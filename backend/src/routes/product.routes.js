import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { upload, deleteLocalUpload } from "../middleware/upload.js";

const router = Router();

function buildImageUrl(req) {
    if (!req.file) {
        return undefined;
    }

    return `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
}

router.get("/", async (req, res, next) => {
    try {
        const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
        res.json(products);
    } catch (err) {
        next(err);
    }
});

router.get("/:id", async (req, res, next) => {
    try {
        const product = await prisma.product.findUnique({ where: { id: Number(req.params.id) } });

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json(product);
    } catch (err) {
        next(err);
    }
});

router.post("/", requireAuth, requireAdmin, upload.single("image"), async (req, res, next) => {
    try {
        const { name, description, price, stock, tag } = req.body;

        const product = await prisma.product.create({
            data: {
                name,
                description,
                price: Number(price),
                stock: Number(stock ?? 0),
                tag,
                imageUrl: buildImageUrl(req),
            },
        });

        res.status(201).json(product);
    } catch (err) {
        next(err);
    }
});

router.put("/:id", requireAuth, requireAdmin, upload.single("image"), async (req, res, next) => {
    try {
        const { name, description, price, stock, tag } = req.body;
        const imageUrl = buildImageUrl(req);

        const previous = imageUrl
            ? await prisma.product.findUnique({ where: { id: Number(req.params.id) } })
            : null;

        const product = await prisma.product.update({
            where: { id: Number(req.params.id) },
            data: {
                name,
                description,
                price: price !== undefined ? Number(price) : undefined,
                stock: stock !== undefined ? Number(stock) : undefined,
                tag,
                imageUrl,
            },
        });

        if (previous?.imageUrl) {
            deleteLocalUpload(previous.imageUrl);
        }

        res.json(product);
    } catch (err) {
        next(err);
    }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const product = await prisma.product.delete({ where: { id: Number(req.params.id) } });
        deleteLocalUpload(product.imageUrl);
        res.status(204).end();
    } catch (err) {
        next(err);
    }
});

export default router;
