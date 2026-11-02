import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import orderRoutes from "./routes/order.routes.js";
import { uploadsDirPath } from "./middleware/upload.js";

// Fail early instead of allowing login or registration to fail later.
if (!process.env.JWT_SECRET?.trim()) {
  throw new Error("JWT_SECRET is required. Configure it in backend/.env.");
}

const PORT = Number(process.env.PORT || 4000);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be a whole number between 1 and 65535.");
}

const app = express();

const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(v => v.trim());
app.disable('x-powered-by');
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
app.use(cors({ origin(origin, callback) { callback(null, !origin || origins.includes(origin)); } }));
app.use(express.json());

app.use("/uploads", express.static(uploadsDirPath));

// Health endpoint.
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
  });
});

// Application routes.
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

// Unmatched routes.
app.use((req, res) => {
  res.status(404).json({
    message: "Not found",
  });
});

// Central error handler.
// This must remain after all application routes.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // Malformed JSON request.
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "Request body contains invalid JSON.",
    });
  }

  // Request exceeds the JSON parser's size limit.
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      message: "Request body is too large.",
    });
  }

  // Multer upload errors.
  if (err.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Image must not exceed 5 MB."
        : "Invalid image upload.";

    return res.status(400).json({
      message,
    });
  }

  // Prisma unique constraint failure.
  if (err.code === "P2002") {
    return res.status(409).json({
      message: "A record with that unique value already exists.",
    });
  }

  // Prisma update/delete target does not exist.
  if (err.code === "P2025") {
    return res.status(404).json({
      message: "The requested record was not found.",
    });
  }

  // Prisma foreign key constraint failure.
  if (err.code === "P2003") {
    return res.status(409).json({
      message: "This operation conflicts with a related record.",
    });
  }

  // Intentional application validation errors.
  if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({
      message: err.message,
    });
  }

  // Keep unexpected technical details in the server terminal.
  console.error(err);

  return res.status(500).json({
    message: "An unexpected server error occurred.",
  });
});


export default app;
