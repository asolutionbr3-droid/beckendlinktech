import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import auth_routes from "./routes/auth.js";
import users from "./routes/users.js";
import payment from "./routes/payment.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://tech-bay-two.vercel.app",
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json());

// ─── Rotas existentes (JWT) ────────────────────────────────────────────────
app.use("/auth", auth_routes);
app.use("/user", users);
app.use("/payment", payment);

// ─── Better Auth ──────────────────────────────────────────────────────────
// Para ativar: cd backend && npm install better-auth
// Descomente as linhas abaixo após instalar:
//
// import { toNodeHandler } from "better-auth/node";
// import { auth } from "./src/lib/auth.js";
// app.all("/api/auth/*", toNodeHandler(auth));

// ─── Test DB ───────────────────────────────────────────────────────────────
app.get("/test-db", async (req, res) => {
  try {
    const { pool } = await import("./db.js");
    const result = await pool.query("SELECT NOW()");
    res.json({ ok: true, time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT} 🚀`));

export default app;
