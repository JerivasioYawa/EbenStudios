import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { inputError } from "../lib/money.js";

export const uploadsDirPath = path.join(process.cwd(), "uploads");
const formats = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
export const upload = multer({
    storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 12, fieldSize: 16_000 },
    fileFilter(req, file, done) {
        if (!Object.values(formats).includes(file.mimetype)) return done(inputError("Only JPEG, PNG, WEBP, or GIF images are allowed."));
        done(null, true);
    },
});

export async function saveValidatedImage(req) {
    if (!req.file) return undefined;
    let output;
    try {
        const image = sharp(req.file.buffer, { failOn: "warning", limitInputPixels: 20_000_000 });
        const metadata = await image.metadata();
        if (formats[metadata.format] !== req.file.mimetype) throw new Error("Format mismatch");
        // Decode pixels, discard metadata/trailing payloads and normalize the first frame.
        output = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    } catch { throw inputError("Image content is invalid, corrupt, too large, or does not match its MIME type."); }
    await mkdir(uploadsDirPath, { recursive: true });
    const filename = randomUUID() + ".png";
    const file = path.join(uploadsDirPath, filename);
    try { await writeFile(file, output, { flag: "wx" }); }
    catch (error) { await unlink(file).catch(() => {}); throw error; }
    return `${req.protocol}://${req.get("host")}/uploads/${filename}`;
}

export async function deleteLocalUpload(imageUrl) {
    if (!imageUrl) return;
    try {
        const { pathname } = new URL(imageUrl);
        const filename = pathname.slice("/uploads/".length);
        if (!pathname.startsWith("/uploads/") || !/^[\da-f-]{36}\.(png|jpe?g|webp|gif)$/i.test(filename)) return;
        await unlink(path.join(uploadsDirPath, filename)).catch(error => { if (error.code !== "ENOENT") throw error; });
    } catch (error) { if (!(error instanceof TypeError)) console.error("Unable to clean up an unused product image.", error.code); }
}

export async function removeUnusedImage(client, imageUrl) {
    if (!imageUrl) return;
    const [products, history] = await Promise.all([
        client.product.count({ where: { imageUrl } }), client.orderItem.count({ where: { productImageUrl: imageUrl } }),
    ]);
    if (!products && !history) await deleteLocalUpload(imageUrl);
}
