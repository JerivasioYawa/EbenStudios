import { prisma } from "./prisma.js";
import { inputError } from "./money.js";

export const MAX_INT = 2_147_483_647;
export function actorData(user) {
    return { actorId: user.sub, actorName: user.name, actorEmail: user.email };
}
export function text(value, label, max, required = false) {
    if (value === undefined && !required) return undefined;
    if (value === null && !required) return null;
    if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) {
        throw inputError(`${label} ${required ? "is required and" : "must be text and"} must not exceed ${max} characters.`);
    }
    return value.trim() || null;
}
export function integer(value, label, min = 0) {
    if (typeof value === "string" && /^\d+$/.test(value)) value = Number(value);
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > MAX_INT) {
        throw inputError(`${label} must be an integer between ${min} and ${MAX_INT}.`);
    }
    return value;
}
export function id(value) { return integer(value, "ID", 1); }
export function pagination(query) {
    const page = integer(query.page ?? 1, "Page", 1);
    const pageSize = integer(query.pageSize ?? 10, "Page size", 1);
    if (pageSize > 100 || (page - 1) * pageSize > MAX_INT) throw inputError("Pagination exceeds the supported range.");
    return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
export function pageResult(items, total, { page, pageSize }) {
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
export function choice(value, allowed, fallback) {
    if (value === undefined || value === "") return fallback;
    if (!allowed.includes(value)) throw inputError("Invalid filter or status.");
    return value;
}

// The audit insert acquires SQLite's writer lock before reading mutable state.
// Both the audit and business writes roll back on failure; no process-local mutex.
export async function adminTransaction(user, action, entityType, entityId, reason, mutate) {
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            return await prisma.$transaction(async tx => {
                const audit = await tx.adminAudit.create({ data: { ...actorData(user), action, entityType, entityId, reason } });
                const result = await mutate(tx);
                await tx.adminAudit.update({ where: { id: audit.id }, data: {
                    action: result.action ?? action,
                    entityId: result.entityId ?? entityId,
                    beforeJson: result.before ? JSON.stringify(result.before) : null,
                    afterJson: result.after ? JSON.stringify(result.after) : null,
                } });
                return result.value;
            }, { maxWait: 10_000, timeout: 10_000 });
        } catch (error) {
            const busy = ["P1008", "P2028", "P2034"].includes(error.code) || /SQLITE_BUSY|database is locked/i.test(error.message);
            if (!busy) throw error;
            if (attempt === 4) throw inputError("The database is busy. Please refresh and try again.", 503);
            await new Promise(resolve => setTimeout(resolve, 20 * 2 ** attempt));
        }
    }
}

export async function stockRecord(tx, user, product, delta, reason, kind = "Manual", orderId = null) {
    return tx.stockAdjustment.create({ data: { ...actorData(user), productId: product.id,
        productName: product.name, delta, beforeStock: product.stock, afterStock: product.stock + delta,
        reason, kind, orderId } });
}
