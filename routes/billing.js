import express from "express";
import mysql from "mysql2/promise";

const router = express.Router();

// ✅ Promise-based MySQL connection
const db = await mysql.createPool({
  host: "localhost",
  user: "root",
  password: "Fmhy@@29",
  database: "fsenterprise",
});

// ============================
// GET ALL BILLS (FOR LIST)
// ============================
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        MIN(id) AS id,
        CONCAT('INV-', LPAD(MIN(id), 4, '0')) AS bill_number,
        customer_name,
        bill_date,
        SUM(total) AS subtotal,
        payment_mode,
        status
      FROM billing
      GROUP BY customer_name, bill_date, payment_mode, status
      ORDER BY bill_date DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Fetch billing error:", error);
    res.status(500).json({ error: "Failed to fetch bills" });
  }
});

// ============================
// VIEW A BILL (FOR VIEW PAGE)
// ============================
router.get("/view/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [billRows] = await db.query(`
      SELECT 
        MIN(id) as id,
        CONCAT('INV-', LPAD(MIN(id), 4, '0')) AS bill_number,
        customer_name,
        bill_date,
        payment_mode,
        status,
        SUM(total) AS subtotal
      FROM billing
      WHERE customer_name = (
        SELECT customer_name FROM billing WHERE id = ?
      )
      AND bill_date = (
        SELECT bill_date FROM billing WHERE id = ?
      )
      GROUP BY customer_name, bill_date, payment_mode, status
    `, [id, id]);

    const [items] = await db.query(`
      SELECT id, gsm_number, description, quantity, price, total
      FROM billing
      WHERE customer_name = (
        SELECT customer_name FROM billing WHERE id = ?
      )
      AND bill_date = (
        SELECT bill_date FROM billing WHERE id = ?
      )
    `, [id, id]);

    if (!billRows.length) {
      return res.status(404).json({ error: "Bill not found" });
    }

    res.json({
      bill: billRows[0],
      items
    });

  } catch (error) {
    console.error("View bill error:", error);
    res.status(500).json({ error: "Failed to fetch bill" });
  }
});


// ============================
// GET SINGLE BILL (FOR EDIT PAGE)
// ============================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(`
      SELECT 
        CONCAT('INV-', LPAD(id, 4, '0')) AS bill_number,
        customer_name,
        bill_date,
        payment_mode,
        status,
        SUM(total) AS subtotal
      FROM billing
      WHERE id = ?
      GROUP BY customer_name, bill_date, payment_mode, status, id
    `, [id]);

    if (!rows.length) return res.status(404).json({ error: "Bill not found" });

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to load bill" });
  }
});



// ============================
// GET BILL ITEMS (FOR EDIT PAGE)
// ============================
router.get("/:id/items", async (req, res) => {
  try {
    const { id } = req.params;

    const [items] = await db.query(
      `SELECT id, gsm_number, description, quantity, price, total
       FROM billing
       WHERE id = ?`,
      [id]
    );

    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Failed to load bill items" });
  }
});


// ============================
// SAVE BILL FROM FRONTEND
// ============================
router.post("/", async (req, res) => {
  try {
    const { customer_name, payment_mode, status, bill_date, items, subtotal } = req.body;

    let lastInsertId = null;

    for (const item of items) {
      const [result] = await db.query(
        `INSERT INTO billing 
        (customer_name, payment_mode, status, bill_date, gsm_number, description, quantity, price, total, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customer_name,
          payment_mode,
          status,
          bill_date,
          item.gsm_number,
          item.description,
          item.quantity,
          item.price,
          item.total,
          subtotal,
        ]
      );
      lastInsertId = result.insertId;
    }

    res.status(200).json({
      success: true,
      id: lastInsertId,
      bill_number: `INV-${String(lastInsertId).padStart(4, "0")}`,
    });
  } catch (error) {
    console.error("Save bill error:", error);
    // 👇 small tweak so you see the REAL DB error in frontend if it happens
    res.status(500).json({ error: error.message || "Failed to save bill" });
  }
});


// ============================
// ✅ UPDATE BILL HEADER
// ============================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name, payment_mode, status, bill_date, subtotal } = req.body;

    await db.query(
      `UPDATE billing 
       SET customer_name=?, payment_mode=?, status=?, bill_date=?, subtotal=?
       WHERE id=?`,
      [customer_name, payment_mode, status, bill_date, subtotal, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Update bill error:", error);
    res.status(500).json({ error: "Failed to update bill" });
  }
});

// ============================
// ✅ UPDATE BILL ITEMS
// ============================
router.put("/:id/items", async (req, res) => {
  try {
    const { id } = req.params;
    const items = req.body;

    // 1. Get old items to restore stock first
    const [oldItems] = await db.query(
      "SELECT gsm_number, quantity FROM billing WHERE id = ?",
      [id]
    );

    // 2. Restore old stock
    for (const old of oldItems) {
      await db.query(
        "UPDATE stock SET quantity = quantity + ? WHERE gsm_number = ?",
        [old.quantity, old.gsm_number]
      );
    }

    // 3. Delete old bill items
    await db.query("DELETE FROM billing WHERE id = ?", [id]);

    // 4. Insert new items + deduct stock safely
    for (const item of items) {
      // ✅ Check stock before deduction
      const [[stockRow]] = await db.query(
        "SELECT quantity FROM stock WHERE gsm_number = ?",
        [item.gsm_number]
      );

      if (!stockRow || stockRow.quantity < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for GSM ${item.gsm_number}`
        });
      }

      // Insert new bill item
      await db.query(
        `INSERT INTO billing 
        (id, customer_name, payment_mode, status, bill_date, gsm_number, description, quantity, price, total, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          item.customer_name,
          item.payment_mode,
          item.status,
          item.bill_date,
          item.gsm_number,
          item.description,
          item.quantity,
          item.price,
          item.total,
          item.subtotal
        ]
      );

      // ✅ Deduct stock correctly
      await db.query(
        "UPDATE stock SET quantity = quantity - ? WHERE gsm_number = ?",
        [item.quantity, item.gsm_number]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Update bill items error:", error);
    res.status(500).json({ error: "Failed to update bill items" });
  }
});

/* ===============================
   DELETE BILL
================================ */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      "DELETE FROM billing WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Bill not found" });
    }

    res.json({ success: true, message: "Bill deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Failed to delete bill" });
  }
});

export default router;
