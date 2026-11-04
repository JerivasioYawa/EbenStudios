import { prisma } from "./prisma.js";
import { actorData, adminTransaction, MAX_INT, text } from "./admin.js";
import { inputError, lineTotalCents } from "./money.js";

const linkFields = { id: true, number: true, status: true, revision: true };
export const invoiceRelations = { lines: { orderBy: { position: "asc" } }, history: { orderBy: { id: "asc" } },
    supersedes: { select: linkFields }, supersededBy: { select: linkFields } };
const partyFields = ["name", "address", "email", "registrationNumber", "taxNumber"];
const upper = key => key[0].toUpperCase() + key.slice(1);
function partyFromRow(row, prefix) {
    return Object.fromEntries([...partyFields, ...(prefix === "seller" ? ["phone"] : [])].map(key => [key, row[prefix + upper(key)]]));
}
function partyToRow(party, prefix) {
    return Object.fromEntries(Object.entries(party).map(([key, value]) => [prefix + upper(key), value]));
}
export function sellerDefaults() {
    return { name: process.env.INVOICE_SELLER_NAME || "Eben Studios", address: process.env.INVOICE_SELLER_ADDRESS || "",
        email: process.env.INVOICE_SELLER_EMAIL || "", phone: process.env.INVOICE_SELLER_PHONE || null,
        registrationNumber: process.env.INVOICE_SELLER_REGISTRATION_NUMBER || null, taxNumber: process.env.INVOICE_SELLER_TAX_NUMBER || null };
}
function object(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw inputError(`${label} must be an object.`);
    return value;
}
function party(input, fallback, label) {
    const value = { ...fallback, ...(input === undefined ? {} : object(input, label)) };
    const allowed = [...partyFields, ...(label === "Seller" ? ["phone"] : [])];
    if (Object.keys(value).some(key => !allowed.includes(key))) throw inputError(`Unknown ${label.toLowerCase()} field.`);
    const result = { name: text(value.name, `${label} name`, 200, true), address: text(value.address, `${label} address`, 2000, true),
        email: text(value.email, `${label} email`, 254, true), registrationNumber: text(value.registrationNumber, "Registration number", 80) ?? null,
        taxNumber: text(value.taxNumber, "Tax number", 80) ?? null };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw inputError(`${label} email is invalid.`);
    if (label === "Seller") result.phone = text(value.phone, "Seller phone", 60) ?? null;
    return result;
}
function details(body, defaults) {
    object(body, "Invoice details");
    if (Object.keys(body).some(key => !["seller", "billing", "notes", "reason"].includes(key))) throw inputError("Only seller, billing, notes and correction reason can be supplied. Amounts come from the order.");
    return { ...partyToRow(party(body.seller, defaults.seller, "Seller"), "seller"),
        ...partyToRow(party(body.billing, defaults.billing, "Billing"), "billing"),
        notes: body.notes === undefined ? (defaults.notes ?? null) : text(body.notes, "Invoice notes", 2000) };
}
function financialLines(order) {
    if (!order.items.length) throw inputError("This order has no billable lines. Review it before issuing an invoice.", 409);
    let sum = 0n;
    const lines = order.items.map((item, index) => {
        if (lineTotalCents(item.unitPriceCents, item.quantity) !== item.lineTotalCents) throw inputError("Order line amounts are inconsistent. Review the order.", 409);
        sum += BigInt(item.lineTotalCents);
        return { position: index + 1, sourceOrderItemId: item.id, productName: item.productName,
            productDescription: item.productDescription, quantity: item.quantity, unitPriceCents: item.unitPriceCents, lineTotalCents: item.lineTotalCents };
    });
    if (order.currency !== "ZAR" || sum + BigInt(order.adjustmentCents) !== BigInt(order.totalCents)) throw inputError("Order totals are inconsistent. Review the order.", 409);
    return lines;
}
const state = row => ({ number: row.number, orderId: row.orderId, revision: row.revision, status: row.status,
    totalCents: row.totalCents, currency: row.currency, supersedesId: row.supersedesId, voidReason: row.voidReason });
async function load(tx, invoiceId) {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: invoiceRelations });
    if (!invoice || invoice.status === "Draft") throw inputError("Invoice not found", 404);
    return invoice;
}
async function orderEvent(tx, user, orderId, type, note) {
    await tx.orderEvent.create({ data: { ...actorData(user), orderId, type, note } });
}
async function create(tx, user, data, lines) {
    const previous = await tx.invoiceSequence.findUnique({ where: { id: 1 } });
    if (previous?.value === MAX_INT) throw inputError("Invoice numbering has reached its supported limit.", 409);
    const sequence = await tx.invoiceSequence.upsert({ where: { id: 1 }, create: { id: 1, value: 1 }, update: { value: { increment: 1 } } });
    const issuedAt = new Date();
    const number = `INV-${issuedAt.getUTCFullYear()}-${String(sequence.value).padStart(6, "0")}`;
    const invoice = await tx.invoice.create({ data: { ...data, number, issuedAt, status: "Draft", issuedById: user.sub,
        issuedByName: user.name, issuedByEmail: user.email, lines: { create: lines } } });
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: "Issued" } });
    await tx.invoiceEvent.create({ data: { invoiceId: invoice.id, ...actorData(user), type: "Issued" } });
    await orderEvent(tx, user, invoice.orderId, "Invoice issued", number);
    return load(tx, invoice.id);
}

export async function issueInvoice(user, orderId, body = {}) {
    return adminTransaction(user, "Invoice issued", "Invoice", 0, undefined, async tx => {
        const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: { orderBy: { id: "asc" } } } });
        if (!order) throw inputError("Order not found", 404);
        const existing = await tx.invoice.findFirst({ where: { orderId }, orderBy: { revision: "desc" }, include: invoiceRelations });
        if (existing) {
            if (existing.status === "Draft") throw inputError("An incomplete invoice requires review.", 409);
            return { value: { invoice: existing, replayed: true }, entityId: existing.id, action: "Invoice issuance replayed", after: state(existing) };
        }
        if (order.fulfilmentStatus === "Cancelled") throw inputError("A cancelled order cannot receive a new invoice.", 409);
        const lines = financialLines(order);
        const snapshots = details(body, { seller: sellerDefaults(), billing: { name: order.customerName, email: order.customerEmail, address: order.shippingAddress } });
        const invoice = await create(tx, user, { ...snapshots, orderId, orderNumber: `#EB-${orderId}`, orderPlacedAt: order.createdAt,
            customerId: order.userId, revision: 1, totalCents: order.totalCents, adjustmentCents: order.adjustmentCents, currency: order.currency }, lines);
        return { value: { invoice, replayed: false }, entityId: invoice.id, after: state(invoice) };
    });
}
async function voidOne(tx, user, invoice, reason, audit = false) {
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: "Voided", voidReason: reason, voidedAt: new Date() } });
    await tx.invoiceEvent.create({ data: { invoiceId: invoice.id, ...actorData(user), type: "Voided", reason } });
    await orderEvent(tx, user, invoice.orderId, "Invoice voided", `${invoice.number}: ${reason}`);
    if (audit) await tx.adminAudit.create({ data: { ...actorData(user), action: "Invoice voided", entityType: "Invoice", entityId: invoice.id,
        reason, beforeJson: JSON.stringify(state(invoice)), afterJson: JSON.stringify({ ...state(invoice), status: "Voided", voidReason: reason }) } });
}
export async function voidInvoice(user, invoiceId, body = {}) {
    const reason = text(body.reason, "Void reason", 500, true);
    return adminTransaction(user, "Invoice voided", "Invoice", invoiceId, reason, async tx => {
        const invoice = await load(tx, invoiceId);
        if (invoice.status === "Voided") {
            if (invoice.voidReason !== reason) throw inputError("This invoice was already voided with a different reason.", 409);
            return { value: invoice, action: "Invoice void replayed", after: state(invoice) };
        }
        await voidOne(tx, user, invoice, reason);
        const saved = await load(tx, invoiceId);
        return { value: saved, before: state(invoice), after: state(saved) };
    });
}
export async function correctInvoice(user, invoiceId, body = {}) {
    const reason = text(body.reason, "Correction reason", 500, true);
    return adminTransaction(user, "Invoice corrected", "Invoice", invoiceId, reason, async tx => {
        const original = await load(tx, invoiceId);
        const snapshots = details(body, { seller: partyFromRow(original, "seller"), billing: partyFromRow(original, "billing"), notes: original.notes });
        if (original.supersededBy) {
            const replacement = await load(tx, original.supersededBy.id);
            const correction = original.history.find(event => event.type === "Corrected");
            if (correction?.reason !== reason || Object.entries(snapshots).some(([key, value]) => replacement[key] !== value)) throw inputError("A different correction already exists. Open the replacement invoice.", 409);
            return { value: { invoice: replacement, replayed: true }, entityId: replacement.id, action: "Invoice correction replayed", after: state(replacement) };
        }
        const order = await tx.order.findUnique({ where: { id: original.orderId } });
        if (order.fulfilmentStatus === "Cancelled") throw inputError("A cancelled order cannot receive a replacement invoice.", 409);
        if (original.revision === MAX_INT) throw inputError("Invoice revision limit reached.", 409);
        if (original.status === "Issued") await voidOne(tx, user, original, reason, true);
        const lines = original.lines.map(({ position, sourceOrderItemId, productName, productDescription, quantity, unitPriceCents, lineTotalCents }) =>
            ({ position, sourceOrderItemId, productName, productDescription, quantity, unitPriceCents, lineTotalCents }));
        const replacement = await create(tx, user, { ...snapshots, orderId: original.orderId, orderNumber: original.orderNumber,
            orderPlacedAt: original.orderPlacedAt, customerId: original.customerId, revision: original.revision + 1, supersedesId: original.id,
            totalCents: original.totalCents, adjustmentCents: original.adjustmentCents, currency: original.currency }, lines);
        await tx.invoiceEvent.create({ data: { invoiceId, ...actorData(user), type: "Corrected", reason, relatedInvoiceId: replacement.id } });
        await tx.invoiceEvent.create({ data: { invoiceId: replacement.id, ...actorData(user), type: "Correction source", reason, relatedInvoiceId: original.id } });
        await tx.adminAudit.create({ data: { ...actorData(user), action: "Invoice issued", entityType: "Invoice", entityId: replacement.id,
            reason, afterJson: JSON.stringify(state(replacement)) } });
        return { value: { invoice: await load(tx, replacement.id), replayed: false }, entityId: replacement.id, before: state(original), after: state(replacement) };
    });
}

export async function voidInvoicesForCancellation(tx, user, orderId, reason) {
    const invoices = await tx.invoice.findMany({ where: { orderId, status: "Issued" } });
    for (const invoice of invoices) await voidOne(tx, user, invoice, `Order cancelled: ${reason}`, true);
}
export function invoiceDto(invoice, admin = false) {
    const result = Object.fromEntries(["id", "number", "orderId", "orderNumber", "orderPlacedAt", "revision", "status", "issuedAt", "voidedAt", "voidReason",
        "totalCents", "adjustmentCents", "currency", "notes", "supersedes", "supersededBy"].map(key => [key, invoice[key]]));
    result.seller = partyFromRow(invoice, "seller"); result.billing = partyFromRow(invoice, "billing");
    result.lines = invoice.lines;
    result.subtotalCents = invoice.lines.reduce((sum, line) => sum + BigInt(line.lineTotalCents), 0n).toString();
    result.history = invoice.history.map(event => {
        const { actorId, actorEmail, ...publicEvent } = event;
        return admin ? event : publicEvent;
    });
    if (admin) result.issuedBy = { id: invoice.issuedById, name: invoice.issuedByName, email: invoice.issuedByEmail };
    return result;
}
