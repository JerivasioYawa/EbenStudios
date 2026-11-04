import { readFile, writeFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";

const [source, output, pageInput = "1"] = process.argv.slice(2);
if (!source || !output) throw new Error("Usage: node scripts/render-invoice-preview.js invoice.pdf preview.png [page]");
const pageNumber = Number(pageInput);
if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new Error("Page must be a positive integer.");
const task = getDocument({ data: new Uint8Array(await readFile(source)), useSystemFonts: false, isEvalSupported: false });
const document = await task.promise;
try {
    const page = await document.getPage(pageNumber), viewport = page.getViewport({ scale: 1.4 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    await writeFile(output, await canvas.encode("png"));
    console.log(JSON.stringify({ page: pageNumber, totalPages: document.numPages, output }));
} finally { await task.destroy(); }
