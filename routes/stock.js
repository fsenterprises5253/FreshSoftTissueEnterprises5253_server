import express from "express";
import db from "../db.js";

const router = express.Router();

/* -------------------------------
   CREATE
-------------------------------- */
router.post("/", (req, res) => {
  const {
    gsm_number,
    category,
    description,
    manufacturer,
    stock,
    cost_price,
    selling_price,
    kg,
    amount,
    minimum_stock,
    unit
  } = req.body;

  const sql = `
    INSERT INTO stock_items 
    (gsm_number, category, description, manufacturer, stock, cost_price, selling_price, kg, amount, minimum_stock, unit) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      gsm_number,
      category,
      description,
      manufacturer,
      stock,
      cost_price,
      selling_price,
      kg,
      amount,
      minimum_stock,
      unit
    ],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: result.insertId });
    }
  );
});

/* -------------------------------
   READ ALL
-------------------------------- */
router.get("/", (req, res) => {
  db.query("SELECT * FROM stock_items ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

/* -------------------------------
   UPDATE
-------------------------------- */
router.put("/:id", (req, res) => {
  const stockId = req.params.id;
  const fields = req.body;

  db.query("UPDATE stock_items SET ? WHERE id = ?", [fields, stockId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

/* -------------------------------
   DELETE
-------------------------------- */
router.delete("/:id", (req, res) => {
  const stockId = req.params.id;

  db.query("DELETE FROM stock_items WHERE id = ?", [stockId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

export default router;
