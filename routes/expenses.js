import express from "express";
import db from "../db.js";

const router = express.Router();

// ✅ GET all expenses (with created_at)
router.get("/", (req, res) => {
  db.query(
    "SELECT id, item, qty, amount, created_at FROM expenses ORDER BY created_at DESC",
    (err, results) => {
      if (err) {
        console.error("Fetch error:", err);
        return res.status(500).json({ message: "Failed to fetch expenses" });
      }
      res.json(results);
    }
  );
});

router.get("/billing-items", async (req, res) => {
  const [rows] = await db.query("SELECT * FROM bill_items");
  res.json(rows);
});

// ✅ CREATE new expense (auto adds created_at)
router.post("/", (req, res) => {
  const { item, qty, amount } = req.body;

  if (!item || !qty || !amount) {
    return res.status(400).json({
      message: "item, qty and amount are required"
    });
  }

  const sql =
    "INSERT INTO expenses (item, qty, amount, created_at) VALUES (?, ?, ?, NOW())";

  db.query(sql, [item, qty, amount], (err, result) => {
    if (err) {
      console.error("Insert error:", err);
      return res.status(500).json({ message: "Failed to save expense" });
    }

    res.status(201).json({
      id: result.insertId,
      item,
      qty,
      amount,
      created_at: new Date()
    });
  });
});

// ✅ UPDATE expense (keeps original created_at)
router.put("/:id", (req, res) => {
  const { item, qty, amount } = req.body;
  const { id } = req.params;

  db.query(
    "UPDATE expenses SET item = ?, qty = ?, amount = ? WHERE id = ?",
    [item, qty, amount, id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ id, item, qty, amount });
    }
  );
});

// ✅ DELETE expense
router.delete("/:id", (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM expenses WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Deleted successfully" });
  });
});

export default router;
