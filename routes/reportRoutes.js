import express from "express";
import mysql from "mysql2/promise";

const router = express.Router();

const db = await mysql.createPool({
  host: "localhost",
  user: "root",
  password: "Fmhy@@29",
  database: "fsenterprise",
});

// ✅ GET ALL BILLS
router.get("/billing", async (req, res) => {
  try {
    const [rows] = await db.query(`
        SELECT 
            b.id AS bill_id,
            b.bill_date,
            bi.gsm_number,
            bi.description,
            bi.quantity,
            bi.price,
            s.cost_price
        FROM billing b
        JOIN bill_items bi ON bi.bill_id = b.id
        LEFT JOIN stock_items s ON s.gsm_number = bi.gsm_number
        ORDER BY b.id DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch billing data" });
  }
});

// ✅ GET ALL EXPENSES
router.get("/expenses", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM expenses ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

// ✅ GET ALL STOCK ITEMS (USED FOR COST PRICE)
router.get("/stock", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM stock_items");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stock items" });
  }
});

router.get("/profit-ledger", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        b.bill_date,
        bi.gsm_number,
        bi.description,
        bi.quantity,
        bi.price,
        s.cost_price
      FROM bill_items bi
      JOIN (
        SELECT MIN(id) AS id, bill_date
        FROM billing
        GROUP BY bill_date
      ) b ON b.id = bi.bill_id
      LEFT JOIN stock_items s ON s.gsm_number = bi.gsm_number
      ORDER BY b.bill_date DESC;
    `);

    res.json(rows);
  } catch (err) {
    console.error("Profit ledger error:", err);
    res.status(500).json({ error: "Failed to fetch profit ledger" });
  }
});


export default router;
