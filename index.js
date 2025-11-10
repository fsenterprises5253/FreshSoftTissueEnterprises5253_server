import express from "express";
import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// ✅ CORS configuration — allows Render frontend or Supabase
app.use(cors({
  origin: "*", // You can replace * with your frontend Render URL for extra security
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

// ✅ Parse JSON request bodies
app.use(express.json());

// ✅ Health Check Endpoint — Render uses this for uptime monitoring
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "🚀 Server is up and running smoothly!"
  });
});

// ✅ Get credentials from environment variables or fallback (for local)
const ADMIN_USER = process.env.ADMIN_USER || "Admin";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || null;

if (!ADMIN_PASSWORD_HASH) {
  console.warn("⚠️ No ADMIN_PASSWORD_HASH set in environment. Using temporary hash for local testing.");
}

// ✅ Local fallback hash (only for testing)
const LOCAL_HASH = bcrypt.hashSync("Rangwala", 10);

const USERS = [
  {
    userId: ADMIN_USER.toLowerCase(),
    passwordHash: ADMIN_PASSWORD_HASH || LOCAL_HASH,
  },
];

// ✅ Login endpoint
app.post("/api/login", async (req, res) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    // Case-insensitive username check
    const user = USERS.find((u) => u.userId === userId.toLowerCase());
    if (!user) {
      console.warn(`❌ Invalid username attempt: ${userId}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      console.warn(`❌ Invalid password attempt for user: ${userId}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log(`✅ Successful login for user: ${userId}`);
    res.status(200).json({ success: true, message: "Login successful ✅" });

  } catch (err) {
    console.error("🔥 Login error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});
