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

/* ============================================================
   ✅ PROFIT LEDGER (BULK INSERT)
   Called from frontend syncBillsToLedger(bills[])
   ============================================================ */
router.post("/profit-ledger/bulk-insert", async (req, res) => {
  const entries = req.body.entries || [];
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: "No entries provided" });
  }

  try {
    const formatted = entries.map(e => {
      const qty = Number(e.quantity || 1);
      const price = Number(e.price || 0);
      const cost = Number(e.cost_price || 0);

      return [
        e.bill_id,
        e.bill_date ? new Date(e.bill_date) : new Date(),
        e.gsm_number || null,
        e.description || "",
        qty,
        price,
        cost,
        price - cost,               // profit per piece
        (price - cost) * qty        // total profit
      ];
    });

    await db.query(
      `INSERT IGNORE INTO profit_ledger 
      (bill_id, bill_date, gsm_number, description, quantity, price, cost_price, profit_per_piece, total_profit)
      VALUES ?`,
      [formatted]
    );

    res.json({ ok: true, inserted: formatted.length });
  } catch (err) {
    console.error("Bulk insert error:", err);
    res.status(500).json({ error: "Bulk insert failed", details: err.message });
  }
});

export default router;
