import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    const adminEmail = process.env.ADMIN_EMAIL?.trim();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword?.trim()) {
        throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set before seeding.");
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            name: "Admin",
            email: adminEmail,
            password: hashedPassword,
            role: "ADMIN",
        },
    });

    const products = [
        { name: "Woodstock Hoodie", priceCents: 119900, stock: 24, tag: "New" },
        { name: "Streets Tee", priceCents: 54900, stock: 58, tag: "Best Seller" },
        { name: "Culture Bomber", priceCents: 239900, stock: 6, tag: "Limited" },
        { name: "Movement Cap", priceCents: 39900, stock: 40, tag: "New" },
    ];

    for (const product of products) {
        await prisma.product.upsert({
            where: { name: product.name },
            update: {},
            create: product,
        });
    }

    console.log("Seed complete.");
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
