import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as service from "../service/invoiceService";
import Invoices from "./Invoices";
import OrderInvoices from "../components/invoices/OrderInvoices";

vi.mock("../service/invoiceService", () => ({ getInvoices: vi.fn(), getMyInvoices: vi.fn(), getInvoice: vi.fn(), getInvoiceConfig: vi.fn(),
    issueInvoice: vi.fn(), correctInvoice: vi.fn(), voidInvoice: vi.fn(), downloadInvoice: vi.fn() }));
const seller = { name: "Test Seller", email: "seller@example.test", address: "Seller Address" };
const billing = { name: "Original Customer", email: "customer@example.test", address: "Original Billing Address" };
const invoice = { id: 1, number: "INV-2026-000001", orderId: 7, orderNumber: "#EB-7", revision: 1, issuedAt: "2026-11-04T12:00:00Z", status: "Issued",
    seller, billing, totalCents: 87, subtotalCents: "87", adjustmentCents: 0, currency: "ZAR", notes: null, history: [], supersedes: null, supersededBy: null,
    lines: [{ id: 1, position: 1, productName: "Original Tee", quantity: 3, unitPriceCents: 29, lineTotalCents: 87 }] };
const page = items => ({ items, total: items.length, page: 1, pageSize: 10, totalPages: 1 });
beforeEach(() => {
    vi.resetAllMocks(); service.getInvoices.mockResolvedValue(page([invoice])); service.getMyInvoices.mockResolvedValue(page([invoice]));
    service.getInvoice.mockResolvedValue(invoice); service.getInvoiceConfig.mockResolvedValue({ seller });
});
function show(admin = false, path = admin ? "/admin/invoices?invoice=1" : "/invoices/1") {
    return render(<MemoryRouter initialEntries={[path]}><Routes>
        <Route path="/admin/invoices" element={<Invoices admin />} /><Route path="/invoices" element={<Invoices />} /><Route path="/invoices/:id" element={<Invoices />} />
    </Routes></MemoryRouter>);
}

it("prepares an invoice from saved order billing details and never submits editable amounts", async () => {
    service.getInvoices.mockResolvedValue(page([])); service.issueInvoice.mockResolvedValue(invoice);
    render(<MemoryRouter initialEntries={["/admin/orders"]}><Routes>
        <Route path="/admin/orders" element={<OrderInvoices order={{ id: 7, customerName: billing.name, customerEmail: billing.email, shippingAddress: billing.address, fulfilmentStatus: "Unfulfilled" }} />} />
        <Route path="/admin/invoices" element={<h1>Issued invoice</h1>} />
    </Routes></MemoryRouter>);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Prepare Invoice", exact: true }));
    expect(await screen.findByLabelText("Billing address", { exact: true })).toHaveValue(billing.address);
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Issue Invoice", exact: true }));
    expect(service.issueInvoice).toHaveBeenCalledWith(7, { seller, billing, notes: "" });
    expect(await screen.findByRole("heading", { name: "Issued invoice", exact: true })).toBeInTheDocument();
});

it("preserves entered details and displays an issuance rejection", async () => {
    service.getInvoices.mockResolvedValue(page([])); service.issueInvoice.mockRejectedValue({ response: { data: { message: "Order totals require review" } } });
    render(<MemoryRouter><OrderInvoices order={{ id: 7, customerName: billing.name, customerEmail: billing.email, shippingAddress: billing.address }} /></MemoryRouter>);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Prepare Invoice", exact: true }));
    await user.click(await screen.findByRole("button", { name: "Issue Invoice", exact: true }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Order totals require review");
    expect(screen.getByLabelText("Billing name", { exact: true })).toHaveValue(billing.name);
});

it("shows a customer's saved amounts and download action without admin mutations", async () => {
    show();
    const detail = await screen.findByRole("region", { name: "Invoice details" });
    expect(await within(detail).findByText("Invoice total: R 0.87")).toBeInTheDocument();
    expect(within(detail).getByText("Original Billing Address")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Void Invoice", exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Correct Details", exact: true })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Download PDF", exact: true }));
    expect(service.downloadInvoice).toHaveBeenCalledWith("1");
    expect(service.getInvoices).not.toHaveBeenCalled();
});

it("shows a private-access failure without a download action or another customer's details", async () => {
    service.getMyInvoices.mockResolvedValue(page([])); service.getInvoice.mockRejectedValue({ response: { data: { message: "Invoice not found" } } });
    show(false, "/invoices/999");
    expect(await screen.findByRole("alert")).toHaveTextContent("Invoice not found");
    expect(screen.queryByText(billing.address)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download PDF" })).not.toBeInTheDocument();
});

it("issues a reasoned replacement with read-only financial data and opens the new document", async () => {
    const replacement = { ...invoice, id: 2, number: "INV-2026-000002", revision: 2, billing: { ...billing, address: "Corrected Address" }, supersedes: { id: 1, number: invoice.number } };
    service.getInvoice.mockImplementation(async ({ id }) => String(id) === "2" ? replacement : invoice);
    service.correctInvoice.mockResolvedValue(replacement);
    show(true); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Correct Details", exact: true }));
    expect(screen.getByLabelText("Correction reason", { exact: true })).toBeRequired();
    await user.clear(screen.getByLabelText("Billing address", { exact: true }));
    await user.type(screen.getByLabelText("Billing address", { exact: true }), "Corrected Address");
    await user.type(screen.getByLabelText("Correction reason", { exact: true }), "Billing address corrected");
    await user.click(screen.getByRole("button", { name: "Issue Replacement", exact: true }));
    expect(service.correctInvoice).toHaveBeenCalledWith("1", expect.objectContaining({ reason: "Billing address corrected", billing: replacement.billing }));
    expect(await screen.findByRole("heading", { name: replacement.number, exact: true })).toBeInTheDocument();
});

it("records a required void reason and refreshes the retained invoice", async () => {
    service.getInvoice.mockResolvedValueOnce(invoice).mockResolvedValue({ ...invoice, status: "Voided", voidReason: "Issued in error" });
    service.voidInvoice.mockResolvedValue({ ...invoice, status: "Voided" });
    show(true); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Void Invoice", exact: true }));
    expect(screen.getByLabelText("Void reason", { exact: true })).toBeRequired();
    await user.type(screen.getByLabelText("Void reason", { exact: true }), "Issued in error");
    await user.click(screen.getByRole("button", { name: "Confirm Void", exact: true }));
    expect(service.voidInvoice).toHaveBeenCalledWith("1", { reason: "Issued in error" });
    expect(await screen.findByText("Voided: Issued in error")).toBeInTheDocument();
});

it("sends invoice search/status filters to the admin list endpoint", async () => {
    show(true, "/admin/invoices"); const user = userEvent.setup();
    await screen.findByRole("link", { name: "View Invoice", exact: true });
    await user.type(screen.getByLabelText("Search invoices"), "INV");
    await user.selectOptions(screen.getByLabelText("Invoice status"), "Voided");
    expect(service.getInvoices).toHaveBeenLastCalledWith(expect.objectContaining({ q: "INV", status: "Voided", page: 1 }), expect.anything());
    expect(service.getMyInvoices).not.toHaveBeenCalled();
});
