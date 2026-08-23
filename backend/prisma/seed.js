import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    const adminPassword = await bcrypt.hash("admin123", 10);

    await prisma.user.upsert({
        where: { email: "admin@ebenstudios.com" },
        update: {},
        create: {
            name: "Admin",
            email: "admin@ebenstudios.com",
            password: adminPassword,
            role: "ADMIN",
        },
    });

    const products = [
        { name: "Woodstock Hoodie", price: 1199, stock: 24, tag: "New" },
        { name: "Streets Tee", price: 549, stock: 58, tag: "Best Seller" },
        { name: "Culture Bomber", price: 2399, stock: 6, tag: "Limited" },
        { name: "Movement Cap", price: 399, stock: 40, tag: "New" },
    ];

    for (const product of products) {
        await prisma.product.upsert({
            where: { name: product.name },
            update: {},
            create: product,
        });
    }

    console.log("Seed complete. Admin login: admin@ebenstudios.com / admin123");
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
