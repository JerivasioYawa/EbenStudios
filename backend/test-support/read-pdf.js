import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function readPdf(bytes) {
    const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, isEvalSupported: false });
    const document = await task.promise, pages = [];
    try {
        for (let index = 1; index <= document.numPages; index++) {
            const page = await document.getPage(index), content = await page.getTextContent();
            pages.push({ text: content.items.map(item => item.str).join(" "), items: content.items, width: page.view[2], height: page.view[3] });
        }
        return pages;
    } finally { await task.destroy(); }
}
