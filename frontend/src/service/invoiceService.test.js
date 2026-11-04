import { Blob as NodeBlob } from "node:buffer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import api from "./api";
import { downloadInvoice } from "./invoiceService";

vi.mock("./api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
beforeEach(() => {
    vi.resetAllMocks(); vi.useFakeTimers();
    vi.stubGlobal("Blob", NodeBlob);
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:private-invoice"), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    localStorage.setItem("eben_auth_token", "session-a");
});
afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const response = () => ({ data: new Blob(["%PDF-test"], { type: "application/pdf" }), headers: { "content-disposition": 'attachment; filename="INV-2026-000001.pdf"' } });

it("downloads a private PDF with the verified session and releases its object URL", async () => {
    api.get.mockResolvedValue(response());
    await downloadInvoice(1);
    expect(api.get).toHaveBeenCalledWith("/invoices/1/pdf", { responseType: "blob", sessionToken: "session-a" });
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click.mock.instances[0].download).toBe("INV-2026-000001.pdf");
    expect(document.querySelector("a[download]")).toBeNull();
    vi.runAllTimers(); expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:private-invoice");
});

it("rejects a guest download before sending a request", async () => {
    localStorage.clear();
    await expect(downloadInvoice(1)).rejects.toThrow(/log in/i);
    expect(api.get).not.toHaveBeenCalled();
});

it("does not deliver a previous account's PDF after an account switch", async () => {
    api.get.mockImplementation(async () => { localStorage.setItem("eben_auth_token", "session-b"); return response(); });
    await expect(downloadInvoice(1)).rejects.toThrow(/account changed/i);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
});

it("reads authenticated download errors from a JSON blob without saving an error document", async () => {
    api.get.mockRejectedValue({ response: { status: 404, data: new Blob([JSON.stringify({ message: "Invoice not found" })]) } });
    await expect(downloadInvoice(2)).rejects.toHaveProperty("message", "Invoice not found");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
});
