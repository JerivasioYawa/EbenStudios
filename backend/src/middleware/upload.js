import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

export const uploadsDirPath = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadsDirPath)) {
    fs.mkdirSync(uploadsDirPath, { recursive: true });
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDirPath),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${crypto.randomUUID()}${ext}`);
    },
});

function fileFilter(req, file, cb) {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
        return cb(Object.assign(new Error("Only JPEG, PNG, WEBP, or GIF images are allowed"), { status: 400 }));
    }

    cb(null, true);
}

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
});

export function deleteLocalUpload(imageUrl) {
    if (!imageUrl) {
        return;
    }

    try {
        const { pathname } = new URL(imageUrl);

        if (!pathname.startsWith("/uploads/")) {
            return;
        }

        const filePath = path.join(uploadsDirPath, path.basename(pathname));
        fs.unlink(filePath, () => {});
    } catch {
        // Not a URL we manage (e.g. an external image link) — nothing to clean up.
    }
}
