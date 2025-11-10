import express from "express";
import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors({ origin: "*", methods: ["GET", "POST"], allowedHeaders: ["Content-Type"] }));
app.use(express.json());

// ✅ Load credentials from environment variables
const USERS = [
  {
    userId: process.env.ADMIN_USER || "Admin",
    passwordHash: process.env.ADMIN_PASSWORD_HASH, // pre-hashed
  },
];

app.post("/api/login", async (req, res) => {
  try {
    const { userId, password } = req.body;
    const user = USERS.find((u) => u.userId === userId);
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return res.status(401).json({ message: "Invalid credentials" });

    res.json({ success: true, message: "Login successful ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
