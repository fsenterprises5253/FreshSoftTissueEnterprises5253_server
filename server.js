import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import db from "./db.js";

import billingRoutes from "./routes/billing.js";
import stockRoutes from "./routes/stock.js";
import expensesRoutes from "./routes/expenses.js"
import reportRoutes from "./routes/reportRoutes.js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Needed for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// -------------------------------
// ROUTES
// -------------------------------

// STOCK OK → /api/stock/**
app.use("/api/stock", stockRoutes);

// BILLING (new bill creation) → /api/billing/**
app.use("/api/billing", billingRoutes);

// EXPENSES → /api/expenses/**
app.use("/api/expenses", expensesRoutes);

// REPORTS → /api/reports/**
app.use("/api", reportRoutes);

// CATCH ALL
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// Serve React build folder
app.use(express.static(path.join(__dirname, "client/build")));

// Fallback route for React Router
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client/build", "index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);

export { db };
