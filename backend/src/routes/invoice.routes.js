import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { choice, id, pageResult, pagination, text } from "../lib/admin.js";
import { correctInvoice, invoiceDto, invoiceRelations, sellerDefaults, voidInvoice } from "../lib/invoices.js";
import { generateInvoicePdf } from "../lib/invoice-pdf.js";
import { inputError } from "../lib/money.js";

const router = Router();
router.use(requireAuth);
async function owned(req) {
    const invoice = await prisma.invoice.findUnique({ where: { id: id(req.params.id) }, include: invoiceRelations });
    if (!invoice || invoice.status === "Draft" || (req.user.role !== "ADMIN" && invoice.customerId !== req.user.sub)) throw inputError("Invoice not found", 404);
    return invoice;
}
async function list(req, res, own) {
    const paging = pagination(req.query), q = text(req.query.q, "Search", 120);
    const status = choice(req.query.status, ["Issued", "Voided"]);
    const orderId = req.query.orderId === undefined || req.query.orderId === "" ? undefined : id(req.query.orderId);
    const where = { status: status || { not: "Draft" }, orderId, ...(own ? { customerId: req.user.sub } : {}),
        ...(q ? { OR: [{ number: { contains: q } }, { orderNumber: { contains: q } }, { billingName: { contains: q } }, { billingEmail: { contains: q } }] } : {}) };
    const [rows, total] = await prisma.$transaction([
        prisma.invoice.findMany({ where, skip: paging.skip, take: paging.take, orderBy: { id: "desc" }, include: invoiceRelations }), prisma.invoice.count({ where }),
    ]);
    res.set("Cache-Control", "private, no-store").json(pageResult(rows.map(row => invoiceDto(row, !own)), total, paging));
}
router.get("/", requireAdmin, async (req, res, next) => { try { await list(req, res, false); } catch (error) { next(error); } });
router.get("/mine", async (req, res, next) => { try { await list(req, res, true); } catch (error) { next(error); } });
router.get("/config", requireAdmin, (req, res) => res.set("Cache-Control", "private, no-store").json({ seller: sellerDefaults() }));
router.get("/:id/pdf", async (req, res, next) => {
    try {
        const invoice = await owned(req);
        const bytes = await generateInvoicePdf(invoiceDto(invoice));
        res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
            "Cache-Control": "private, no-store", "Pragma": "no-cache", "Vary": "Authorization", "X-Content-Type-Options": "nosniff" }).send(bytes);
    } catch (error) { next(error); }
});
router.get("/:id", async (req, res, next) => {
    try { res.set("Cache-Control", "private, no-store").json(invoiceDto(await owned(req), req.user.role === "ADMIN")); }
    catch (error) { next(error); }
});
router.post("/:id/void", requireAdmin, async (req, res, next) => {
    try { res.json(invoiceDto(await voidInvoice(req.user, id(req.params.id), req.body || {}), true)); }
    catch (error) { next(error); }
});
router.post("/:id/corrections", requireAdmin, async (req, res, next) => {
    try {
        const { invoice, replayed } = await correctInvoice(req.user, id(req.params.id), req.body || {});
        res.set("Invoice-Replayed", String(replayed)).status(replayed ? 200 : 201).json(invoiceDto(invoice, true));
    } catch (error) { next(error); }
});
export default router;
