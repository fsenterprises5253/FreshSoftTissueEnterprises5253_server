import db from "../db.js";

// GET ALL STOCK ITEMS
export const getAllStock = (req, res) => {
  db.query("SELECT * FROM stock_items ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

// CREATE NEW STOCK ITEM
export const createStock = (req, res) => {
  const data = req.body;

  db.query("INSERT INTO stock_items SET ?", data, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: result.insertId });
  });
};

// UPDATE STOCK ITEM
export const updateStock = (req, res) => {
  const { id } = req.params;
  const data = req.body;

  db.query(
    "UPDATE stock_items SET ? WHERE id = ?",
    [data, id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
};

// DELETE STOCK ITEM
export const deleteStock = (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM stock_items WHERE id = ?", id, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
};
