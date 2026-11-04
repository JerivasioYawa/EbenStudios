import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import orderRoutes from "./routes/order.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import likeRoutes from "./routes/like.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import { uploadsDirPath } from "./middleware/upload.js";

const app = express();

app.use(cors({ exposedHeaders: ["Content-Disposition", "Invoice-Replayed"] }));
app.use(express.json());
app.use("/uploads", express.static(uploadsDirPath));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/likes", likeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/invoices", invoiceRoutes);

app.use((req, res) => {
    res.status(404).json({ message: "Not found" });
});

app.use((err, req, res, next) => {
    console.error(err);
    const status = err.status || (err.name === "MulterError" ? 400 : err.code === "P2002" ? 409 : err.code === "P2025" ? 404 : 500);
    res.status(status).json({ message: err.code === "P2002" ? "A record with these details already exists." : status === 500 ? "Server error" : err.message });
});

export default app;
