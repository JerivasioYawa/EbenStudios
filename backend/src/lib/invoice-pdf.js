import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";

const regular = fileURLToPath(new URL("../../assets/fonts/NotoSans-Regular.ttf", import.meta.url));
const bold = fileURLToPath(new URL("../../assets/fonts/NotoSans-Bold.ttf", import.meta.url));
export function invoiceMoney(cents) {
    const value = BigInt(cents), amount = value < 0n ? -value : value;
    return (value < 0n ? "-" : "") + "R " + (amount / 100n).toLocaleString("en-US") + "." + (amount % 100n).toString().padStart(2, "0");
}
const clean = value => String(value ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ");

export async function generateInvoicePdf(invoice) {
    const doc = new PDFDocument({ autoFirstPage: false, bufferPages: true, size: "A4", margin: 40, compress: true,
        info: { Title: invoice.number, Author: invoice.seller.name, Subject: `Invoice for ${invoice.orderNumber}`,
            CreationDate: new Date(invoice.issuedAt), ModDate: new Date(invoice.voidedAt || invoice.issuedAt) } });
    const chunks = [];
    const complete = new Promise((resolve, reject) => {
        doc.on("data", chunk => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
    });
    doc.registerFont("Regular", regular); doc.registerFont("Bold", bold);
    let y = 0, pageCount = 0, section = "parties";
    const left = 40, right = 555, bodyBottom = 780;
    function draw(value, x, top, width, size = 10, font = "Regular", align = "left", color = "#111111") {
        doc.font(font).fontSize(size).fillColor(color);
        const content = clean(value);
        const position = align === "right" ? x + width - doc.widthOfString(content) : x;
        doc.text(content, position, top, { lineBreak: false });
    }
    function wrap(value, width, size = 10, font = "Regular") {
        doc.font(font).fontSize(size);
        const lines = [];
        for (const paragraph of clean(value).split("\n")) {
            let current = "";
            for (const word of paragraph.split(/\s+/).filter(Boolean)) {
                const candidate = current ? current + " " + word : word;
                if (doc.widthOfString(candidate) <= width) { current = candidate; continue; }
                if (current) { lines.push(current); current = ""; }
                for (const character of word) {
                    if (current && doc.widthOfString(current + character) > width) { lines.push(current); current = ""; }
                    current += character;
                }
            }
            lines.push(current);
        }
        return lines;
    }
    function tableHeader() {
        doc.rect(left, y, right - left, 25).fill("#eeeeee");
        draw("Item / description", 45, y + 6, 255, 9, "Bold");
        draw("Qty", 295, y + 6, 60, 9, "Bold", "right");
        draw("Unit price", 360, y + 6, 89, 9, "Bold", "right");
        draw("Line total", 456, y + 6, 94, 9, "Bold", "right");
        y += 34;
    }
    function page() {
        doc.addPage(); pageCount++;
        draw(invoice.status === "Voided" ? "VOIDED INVOICE" : "INVOICE", left, 34, 245, 18, "Bold");
        draw(invoice.number, 285, 37, 270, 13, "Bold", "right");
        draw(`${invoice.orderNumber}  |  Revision ${invoice.revision}`, left, 65, 255, 9);
        draw(`Issued ${new Date(invoice.issuedAt).toISOString().slice(0, 10)}  |  ${invoice.currency}`, 300, 65, 255, 9, "Regular", "right");
        doc.moveTo(left, 87).lineTo(right, 87).strokeColor("#bbbbbb").stroke(); y = 102;
        if (section === "items") tableHeader();
        else if (section === "parties" && pageCount > 1) { draw("Seller / bill to (continued)", left, y, 515, 9, "Bold"); y += 20; }
    }
    function space(height) { if (y + height > bodyBottom) { page(); return true; } return false; }
    function paragraph(value, size = 10, font = "Regular") {
        for (const line of wrap(value, 515, size, font)) { space(size + 6); draw(line, left, y, 515, size, font); y += size + 5; }
    }
    try {
        page();
        const partyLines = party => [party.name, party.address, party.email, ...(party.phone ? [party.phone] : []),
            ...(party.registrationNumber ? ["Registration: " + party.registrationNumber] : []), ...(party.taxNumber ? ["Tax registration: " + party.taxNumber] : [])]
            .flatMap(value => wrap(value, 240));
        const seller = ["Seller", ...partyLines(invoice.seller)], billing = ["Bill to", ...partyLines(invoice.billing)];
        for (let index = 0; index < Math.max(seller.length, billing.length); index++) {
            space(16); if (seller[index]) draw(seller[index], left, y, 240, 10, index === 0 ? "Bold" : "Regular");
            if (billing[index]) draw(billing[index], 310, y, 245, 10, index === 0 ? "Bold" : "Regular"); y += 16;
        }
        y += 18; section = "items";
        if (!space(55)) tableHeader();
        for (const line of invoice.lines) {
            const rows = [...wrap(`${line.position}. ${line.productName}`, 240).map(value => ({ value, size: 10 })),
                ...(line.productDescription ? wrap(line.productDescription, 240, 9).map(value => ({ value, size: 9 })) : [])];
            for (let index = 0; index < rows.length; index++) {
                if (space(16) && index > 0) { draw(`Item ${line.position} (continued)`, 45, y, 255, 9, "Bold"); y += 16; }
                draw(rows[index].value, 45, y, 240, rows[index].size);
                if (index === 0) {
                    draw(String(line.quantity), 295, y, 60, 9, "Regular", "right");
                    draw(invoiceMoney(line.unitPriceCents), 360, y, 89, 9, "Regular", "right");
                    draw(invoiceMoney(line.lineTotalCents), 456, y, 94, 9, "Regular", "right");
                }
                y += 16;
            }
            y += 5; doc.moveTo(left, y).lineTo(right, y).strokeColor("#dddddd").stroke(); y += 9;
        }
        section = "summary"; space(95); y += 10;
        const subtotal = invoice.lines.reduce((sum, line) => sum + BigInt(line.lineTotalCents), 0n);
        draw("Line subtotal", 300, y, 140); draw(invoiceMoney(subtotal), 440, y, 115, 10, "Regular", "right"); y += 22;
        if (invoice.adjustmentCents !== 0) { draw("Historical adjustment", 300, y, 140); draw(invoiceMoney(invoice.adjustmentCents), 440, y, 115, 10, "Regular", "right"); y += 22; }
        draw("Invoice total", 300, y, 140, 12, "Bold"); draw(invoiceMoney(invoice.totalCents), 430, y, 125, 12, "Bold", "right"); y += 34;
        if (invoice.supersedes) paragraph(`Replaces ${invoice.supersedes.number}. The earlier invoice is retained as voided.`, 9);
        if (invoice.status === "Voided") { paragraph(`VOIDED: ${invoice.voidReason}`, 10, "Bold"); if (invoice.supersededBy) paragraph(`Replacement: ${invoice.supersededBy.number}`, 9); }
        if (invoice.notes) { y += 10; paragraph("Notes", 10, "Bold"); paragraph(invoice.notes, 9); }
        y += 12; paragraph("This invoice records the order amount. Payment is recorded separately.", 9);
        const range = doc.bufferedPageRange();
        for (let index = range.start; index < range.start + range.count; index++) {
            doc.switchToPage(index);
            draw(invoice.number, left, 810, 300, 8, "Regular", "left", "#555555");
            draw(`Page ${index + 1} of ${range.count}`, 400, 810, 155, 8, "Regular", "right", "#555555");
        }
        doc.end();
    } catch (error) { doc.destroy(error); }
    return complete;
}
