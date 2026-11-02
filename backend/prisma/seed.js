import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
async function main() {
    const name = process.env.SEED_ADMIN_NAME?.trim() || "Local Administrator";
    const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password || password.length < 16 || Buffer.byteLength(password, "utf8") > 72) {
        throw new Error("Configure a seed email and an administrator password of at least 16 characters and at most 72 UTF-8 bytes.");
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.role !== "ADMIN") throw new Error("Seed email belongs to a non-admin account.");
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.upsert({ where: { email }, update: { name, password: hashed }, create: { name, email, password: hashed, role: "ADMIN" } });
    const products = [
        { name: "Woodstock Hoodie", priceCents: 119900, stock: 24, tag: "New" },
        { name: "Streets Tee", priceCents: 54900, stock: 58, tag: "Best Seller" },
        { name: "Culture Bomber", priceCents: 239900, stock: 6, tag: "Limited" },
        { name: "Movement Cap", priceCents: 39900, stock: 40, tag: "New" },
    ];
    for (const product of products) await prisma.product.upsert({ where: { name: product.name }, update: {}, create: product });
    console.log("Seed complete. Existing product stock, price and archive state were preserved.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
