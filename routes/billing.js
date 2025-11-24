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

    const [billRows] = await db.query(
      `
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
    `,
      [id, id]
    );

    const [items] = await db.query(
      `
      SELECT id, gsm_number, description, quantity, price, total
      FROM billing
      WHERE customer_name = (
        SELECT customer_name FROM billing WHERE id = ?
      )
      AND bill_date = (
        SELECT bill_date FROM billing WHERE id = ?
      )
    `,
      [id, id]
    );

    if (!billRows.length) {
      return res.status(404).json({ error: "Bill not found" });
    }

    res.json({
      bill: billRows[0],
      items,
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

    const [rows] = await db.query(
      `
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
    `,
      [id]
    );

    if (!rows.length) return res.status(404).json({ error: "Bill not found" });

    res.json(rows[0]);
  } catch (error) {
    console.error("Get bill error:", error);
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
      `
      SELECT id, gsm_number, description, quantity, price, total
      FROM billing
      WHERE id = ?
    `,
      [id]
    );

    res.json(items);
  } catch (error) {
    console.error("Get bill items error:", error);
    res.status(500).json({ error: "Failed to load bill items" });
  }
});

// ============================
// SAVE BILL FROM FRONTEND
// ============================
router.post("/", async (req, res) => {
  try {
    // ✅ RESET BILL NUMBER IF ALL BILLS ARE DELETED
    const [countResult] = await db.query(
      "SELECT COUNT(*) AS total FROM billing"
    );

    if (countResult[0].total === 0) {
      await db.query("ALTER TABLE billing AUTO_INCREMENT = 1");
    }

    const { customer_name, payment_mode, status, bill_date, items, subtotal } =
      req.body;
    let lastInsertId = null;

    for (const item of items) {
      const safeQuantity = Number(
        item.quantity ?? item.stock ?? 0
      ); // support both names from frontend
      const safeGsm = Number(item.gsm_number);

      const [result] = await db.query(
        `
        INSERT INTO billing 
          (customer_name, payment_mode, status, bill_date, gsm_number, description, quantity, price, total, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          customer_name,
          payment_mode,
          status,
          bill_date,
          safeGsm,
          item.description,
          safeQuantity,
          item.price,
          item.total,
          subtotal,
        ]
      );

      lastInsertId = result.insertId;

      // ✅ SUBTRACT STOCK QUANTITY WHEN BILL IS CREATED
      if (!isNaN(safeGsm) && safeQuantity > 0) {
        await db.query(
          "UPDATE stock_items SET stock = stock - ? WHERE gsm_number = ? AND description = ?",
          [safeQuantity, safeGsm, item.description]
        );
      }
    }

    res.status(200).json({
      success: true,
      id: lastInsertId,
      bill_number: `INV-${String(lastInsertId).padStart(4, "0")}`,
    });
  } catch (error) {
    console.error("Save bill error:", error);
    res.status(500).json({ error: error.message || "Failed to save bill" });
  }
});

// ============================
// UPDATE BILL HEADER
// ============================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name, payment_mode, status, bill_date, subtotal } =
      req.body;

    await db.query(
      `
      UPDATE billing 
      SET customer_name=?, payment_mode=?, status=?, bill_date=?, subtotal=?
      WHERE id=?
    `,
      [customer_name, payment_mode, status, bill_date, subtotal, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Update bill error:", error);
    res.status(500).json({ error: "Failed to update bill" });
  }
});

// ============================
// UPDATE BILL ITEMS
// ============================
router.put("/:id/items", async (req, res) => {
  try {
    const { id } = req.params;
    const items = req.body;

    // ✅ 3. UPDATE existing rows instead of deleting
    for (const item of items) {
      const qty = Number(item.quantity);
      const gsm = Number(item.gsm_number);

      // 1. Get previous quantity of this item in the bill
      const [oldItem] = await db.query(
        "SELECT quantity FROM billing WHERE id = ? AND gsm_number = ? AND description = ?",
        [id, gsm, item.description]
      );

      const oldQty = oldItem.length ? Number(oldItem[0].quantity) : 0;

      // 2. Restore old stock
      await db.query(
        "UPDATE stock_items SET stock = stock + ? WHERE gsm_number = ? AND description = ?",
        [oldQty, gsm, item.description]
      );

      // 3. Deduct new stock
      await db.query(
        "UPDATE stock_items SET stock = stock - ? WHERE gsm_number = ? AND description = ?",
        [qty, gsm, item.description]
      );

      // 4. Update bill row
      await db.query(
        `UPDATE billing 
        SET quantity = ?, price = ?, total = ?, subtotal = ?
        WHERE id = ? AND gsm_number = ? AND description = ?`,
        [qty, item.price, item.total, item.total, id, gsm, item.description]
      );
    }
    
    res.json({ success: true, message: "Bill updated successfully" });
  } catch (error) {
    console.error("Edit bill error:", error);
    res.status(500).json({ error: error.message });
  }
});


// ============================
// DELETE BILL
// ============================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query("DELETE FROM billing WHERE id = ?", [id]);

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
