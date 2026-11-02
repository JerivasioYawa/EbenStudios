import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const prisma = new PrismaClient();
const plain = value => JSON.parse(JSON.stringify(value, (_, v) => typeof v === "bigint" ? Number(v) : v));
async function main() {
    const before = JSON.parse(await readFile("phase4-before.json", "utf8"));
    const products = plain(await prisma.$queryRawUnsafe('SELECT id,name,priceCents,stock,isActive FROM "Product" ORDER BY id'));
    const orders = plain(await prisma.$queryRawUnsafe('SELECT id,userId,totalCents,status,stockRestored FROM "Order" ORDER BY id'));
    const items = plain(await prisma.$queryRawUnsafe('SELECT id,orderId,productId,quantity,unitPriceCents,productName FROM "OrderItem" ORDER BY id'));
    const users = plain(await prisma.$queryRawUnsafe('SELECT COUNT(*) AS count FROM "User"'))[0].count;
    assert.equal(users,before.users,"User count changed");
    assert.equal(products.length,before.products.length,"Product count changed");
    assert.equal(orders.length,before.orders.length,"Order count changed");
    assert.equal(items.length,before.items.length,"Order item count changed");
    for (const p of products) {
        const old=before.products.find(x=>x.id===p.id); assert.ok(old);
        assert.equal(p.priceCents,old.expectedCents,`Product ${p.id} price`);
        assert.equal(p.stock,old.stock,`Product ${p.id} stock`);
        assert.equal(p.name,old.name); assert.equal(Boolean(p.isActive),true);
    }
    for (const o of orders) {
        const old=before.orders.find(x=>x.id===o.id); assert.ok(old);
        assert.equal(o.totalCents,old.expectedCents,`Order ${o.id} total`);
        assert.equal(o.userId,old.userId); assert.equal(o.status,old.status);
        assert.equal(Boolean(o.stockRestored),Boolean(old.stockRestored));
    }
    for (const i of items) {
        const old=before.items.find(x=>x.id===i.id); assert.ok(old);
        assert.equal(i.unitPriceCents,old.expectedCents); assert.equal(i.quantity,old.quantity);
        assert.equal(i.orderId,old.orderId); assert.equal(i.productId,old.productId);
        assert.equal(i.productName,before.products.find(x=>x.id===i.productId).name);
    }
    assert.deepEqual(plain(await prisma.$queryRawUnsafe('PRAGMA foreign_key_check')),[]);
    console.log("PASS: row counts, identifiers, monetary conversions, stock, status, references and name backfills match the preflight snapshot.");
    console.log("This verifies migration preservation, not full HTTP/browser behaviour.");
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
