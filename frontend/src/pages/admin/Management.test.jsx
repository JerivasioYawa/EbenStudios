import { beforeEach, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import * as service from "../../service/adminService";
import * as products from "../../service/productService";
import Products from "./Products";
import Orders from "./Orders";
import Dashboard from "./Dashboard";

vi.mock("../../service/adminService", () => ({
    getAdminProducts: vi.fn(), getProductHistory: vi.fn(), getAdminOrders: vi.fn(), getAdminOrder: vi.fn(), getDashboard: vi.fn(), getAudit: vi.fn(),
    adjustStock: vi.fn(), archiveProduct: vi.fn(), cancelOrder: vi.fn(), changeFulfilment: vi.fn(), confirmPayment: vi.fn(), recordRefund: vi.fn(), updateShipping: vi.fn(),
}));
vi.mock("../../service/productService", () => ({ createProduct: vi.fn(), updateProduct: vi.fn(), deleteProduct: vi.fn() }));
const product = { id: 1, name: "Admin Tee", price: 0.29, priceCents: 29, stock: 2, lowStockThreshold: 3, lowStock: true, archivedAt: null };
const page = items => ({ items, total: items.length, page: 1, pageSize: 10, totalPages: 1 });
const order = { id: 7, customerName: "Saved Customer", customerEmail: "customer@example.test", shippingAddress: "Saved Street", totalCents: 87,
    adjustmentCents: 0, paymentStatus: "Pending", fulfilmentStatus: "Unfulfilled", payments: [], history: [], items: [{ id: 1, productName: "Original Tee", quantity: 3, unitPriceCents: 29, lineTotalCents: 87 }] };
beforeEach(() => {
    vi.resetAllMocks();
    service.getAdminProducts.mockResolvedValue(page([product]));
    service.getAdminOrders.mockResolvedValue(page([order]));
    service.getAdminOrder.mockResolvedValue(order);
    service.getAudit.mockResolvedValue(page([]));
});
const show = (element, path = "/admin") => render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);

it("sends product filters and pagination to the server and exposes low-stock state", async () => {
    service.getAdminProducts.mockResolvedValue({ ...page([product]), total: 12, totalPages: 2 });
    show(<Products />);
    expect(await screen.findByText("Low stock")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Next", exact: true }));
    expect(service.getAdminProducts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.anything());
    await user.type(screen.getByLabelText("Search products"), "Tee");
    await user.selectOptions(screen.getByLabelText("Visibility"), "archived");
    expect(service.getAdminProducts).toHaveBeenLastCalledWith(expect.objectContaining({ q: "Tee", status: "archived", page: 1 }), expect.anything());
});

it("saves product edits without overwriting stock and can clear optional text", async () => {
    show(<Products />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Edit", exact: true }));
    expect(screen.queryByPlaceholderText("Stock")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Description"), "Text to clear");
    await user.clear(screen.getByLabelText("Description"));
    await user.click(screen.getByRole("button", { name: "Save Changes", exact: true }));
    expect(products.updateProduct).toHaveBeenCalledWith(1, expect.objectContaining({ description: "", price: 0.29 }));
    expect(products.updateProduct.mock.calls[0][1]).not.toHaveProperty("stock");
});

it("submits a stock delta and reason and keeps server rejections visible", async () => {
    service.adjustStock.mockRejectedValue({ response: { data: { message: "Stock adjustment would exceed valid stock bounds." } } });
    show(<Products />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Adjust Stock", exact: true }));
    await user.type(screen.getByLabelText("Stock adjustment", { exact: true }), "-3");
    await user.type(screen.getByLabelText("Reason", { exact: true }), "Physical count");
    await user.click(screen.getByRole("button", { name: "Save Adjustment", exact: true }));
    expect(service.adjustStock).toHaveBeenCalledWith(1, { delta: -3, reason: "Physical count" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Stock adjustment would exceed valid stock bounds.");
});

it("requires an archive reason and uses the selected product", async () => {
    show(<Products />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Archive", exact: true }));
    expect(screen.getByLabelText("Reason")).toBeRequired();
    await user.type(screen.getByLabelText("Reason"), "Season ended");
    await user.click(screen.getByRole("button", { name: "Save Status", exact: true }));
    expect(service.archiveProduct).toHaveBeenCalledWith(1, { archived: true, reason: "Season ended" });
});

it("shows saved order details, payment state and validation failures without pretending a transition succeeded", async () => {
    service.cancelOrder.mockRejectedValue({ response: { data: { message: "This fulfilment transition is not allowed." } } });
    show(<Orders />, "/admin/orders?order=7");
    const user = userEvent.setup();
    const details = await screen.findByRole("region", { name: "Order details" });
    expect(await within(details).findByText("Saved Street")).toBeInTheDocument();
    expect(within(details).getByText("Original Tee × 3 at R 0.29")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start Processing" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Cancellation reason"), "Requested cancellation");
    await user.click(screen.getByRole("button", { name: "Cancel Order", exact: true }));
    expect(service.cancelOrder).toHaveBeenCalledWith(7, { reason: "Requested cancellation" });
    expect(await screen.findByRole("alert")).toHaveTextContent("transition is not allowed");
    expect(within(details).getByText("Unfulfilled", { exact: true })).toBeInTheDocument();
});

it("records a referenced full payment before exposing fulfilment controls", async () => {
    service.getAdminOrder.mockResolvedValueOnce(order).mockResolvedValue({ ...order, paymentStatus: "Confirmed" });
    show(<Orders />, "/admin/orders?order=7");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Payment reference", { exact: true }), "BANK-123");
    await user.click(screen.getByRole("button", { name: "Confirm Payment", exact: true }));
    expect(service.confirmPayment).toHaveBeenCalledWith(7, { reference: "BANK-123", amountCents: 87 });
    expect(await screen.findByRole("button", { name: "Start Processing", exact: true })).toBeInTheDocument();
});

it("uses the confirmed-payment aggregate rather than summing displayed order values", async () => {
    service.getDashboard.mockResolvedValue({ confirmedPaymentsCents: "87", awaitingRefundCents: "20000", refundedCents: "10000",
        pendingOrders: 9, unverifiedOrders: 0, orders: 10, customers: 2, products: 4, archivedProducts: 1, lowStock: [], recentOrders: [{ ...order, totalCents: 999999 }] });
    show(<Dashboard />);
    const title = await screen.findByRole("heading", { name: "Confirmed payments", exact: true });
    expect(title.parentElement).toHaveTextContent("R 0.87");
    expect(title.parentElement).not.toHaveTextContent("9,999.99");
    expect(screen.getByRole("heading", { name: "Cancelled payments awaiting refund", exact: true }).parentElement).toHaveTextContent("R 200.00");
});

it("disables order inputs while a preceding transition is pending", async () => {
    let finish;
    service.getAdminOrder.mockResolvedValue({ ...order, paymentStatus: "Confirmed" });
    service.changeFulfilment.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    show(<Orders />, "/admin/orders?order=7");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Start Processing", exact: true }));
    expect(screen.getByLabelText("Cancellation reason")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel Order", exact: true })).toBeDisabled();
    await act(async () => { finish({ ...order, paymentStatus: "Confirmed", fulfilmentStatus: "Processing" }); });
    expect(await screen.findByLabelText("Cancellation reason")).toBeEnabled();
});
