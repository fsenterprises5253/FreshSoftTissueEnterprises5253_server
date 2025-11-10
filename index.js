import express from "express";
import bcrypt from "bcrypt";
import cors from "cors";

const app = express();

// ✅ Allow all origins (for Supabase + Render Frontend)
app.use(cors({ origin: "*", methods: ["GET", "POST"], allowedHeaders: ["Content-Type"] }));

// ✅ Parse JSON requests
app.use(express.json());

// ✅ Health check (Render uses this to verify uptime)
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running fine ✅" });
});

// ✅ Simulated user data (for demo authentication)
const USERS = [
  {
    userId: "Admin",
    passwordHash: await bcrypt.hash("Rangwala", 10),
  },
];

// ✅ Login route
app.post("/api/login", async (req, res) => {
  try {
    const { userId, password } = req.body;
    if (!userId || !password)
      return res.status(400).json({ message: "Missing credentials" });

    const user = USERS.find((u) => u.userId === userId);
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return res.status(401).json({ message: "Invalid credentials" });

    res.json({ success: true, message: "Login successful ✅" });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
