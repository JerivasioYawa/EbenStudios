import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { writeFile } from "node:fs/promises";
const prisma = new PrismaClient();
const plain = value => JSON.parse(JSON.stringify(value, (_, v) => typeof v === "bigint" ? Number(v) : v));
const failures = [];
function cents(value, label) {
    const scaled = value * 100;
    const rounded = Math.round(scaled);
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || !Number.isSafeInteger(rounded) || rounded > 2147483647 || Math.abs(scaled-rounded) > 0.000001) {
        failures.push(`${label}: negative, outside Int range, or not representable as two-decimal money.`);
    }
    return rounded;
}
async function main() {
    const columns = plain(await prisma.$queryRawUnsafe('PRAGMA table_info("Order")')).map(c => c.name);
    if (!["total"].every(c => columns.includes(c))) {
        throw new Error("Expected the completed Phase 3 database with old total column. Do not run this after Phase 4 migration.");
    }
    const products = plain(await prisma.$queryRawUnsafe('SELECT id,name,price,stock FROM "Product" ORDER BY id'));
    const stockColumn = columns.includes('stockRestored') ? 'stockRestored' : '0 AS stockRestored';
    const orders = plain(await prisma.$queryRawUnsafe(`SELECT id,userId,total,status,${stockColumn} FROM "Order" ORDER BY id`));
    const items = plain(await prisma.$queryRawUnsafe('SELECT id,orderId,productId,quantity,price FROM "OrderItem" ORDER BY id'));
    const users = plain(await prisma.$queryRawUnsafe('SELECT COUNT(*) AS count FROM "User"'))[0].count;
    const fk = plain(await prisma.$queryRawUnsafe('PRAGMA foreign_key_check'));
    if (fk.length) failures.push("Foreign key violations exist.");
    for (const p of products) {
        p.expectedCents = cents(p.price, `Product ${p.id}`);
        if (!Number.isInteger(p.stock) || p.stock < 0 || p.stock > 2147483647) failures.push(`Product ${p.id}: invalid stock.`);
    }
    for (const item of items) {
        item.expectedCents = cents(item.price, `OrderItem ${item.id}`);
        if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 2147483647) failures.push(`OrderItem ${item.id}: invalid quantity.`);
    }
    for (const order of orders) {
        order.expectedCents = cents(order.total, `Order ${order.id}`);
        const children = items.filter(i => i.orderId === order.id);
        if (!children.length) failures.push(`Order ${order.id}: contains no items.`);
        const calculated = children.reduce((sum, i) => sum + i.quantity*i.expectedCents, 0);
        if (calculated !== order.expectedCents) failures.push(`Order ${order.id}: stored total differs from its item total.`);
        if (!["Pending","Paid","Shipped","Delivered","Cancelled"].includes(order.status)) failures.push(`Order ${order.id}: unsupported status.`);
        if (![0,1,false,true].includes(order.stockRestored)) failures.push(`Order ${order.id}: invalid stock flag.`);
    }
    if (failures.length) throw new Error("Preflight failed; no data changed:\n" + failures.join("\n"));
    await writeFile("phase4-before.json", JSON.stringify({ products, orders, items, users }, null, 2));
    console.log(`PASS: ${products.length} products, ${orders.length} orders, ${items.length} items checked. Snapshot: phase4-before.json`);
    console.log("Keep the API and Studio stopped until migration and verification finish.");
}
main().catch(error => { console.error(error.message); process.exitCode=1; }).finally(() => prisma.$disconnect());
