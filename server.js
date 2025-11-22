import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import db from "./db.js";

import billingRoutes from "./routes/billing.js";
import stockRoutes from "./routes/stock.js";
import expensesRoutes from "./routes/expenses.js"

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// -------------------------------
// ROUTES
// -------------------------------

// STOCK OK → /api/stock/**
app.use("/api/stock", stockRoutes);

// BILLING (new bill creation) → /api/billing/**
app.use("/api/billing", billingRoutes);

// EXPENSES → /api/expenses/**
app.use("/api/expenses", expensesRoutes);

// CATCH ALL
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);

export { db };
