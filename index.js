import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import auth_routes from "./routes/auth.js";
import users from "./routes/users.js";
import payment from "./routes/payment.js";

dotenv.config();

const app = express();

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://tech-production-6d4f.up.railway.app",
  process.env.FRONTEND_URL,
].filter((v, i, arr) => v && arr.indexOf(v) === i); // deduplica

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
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

// ─── Health check ─────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ ok: true, status: "running", timestamp: new Date().toISOString() });
});

// ─── Test DB ───────────────────────────────────────────────────────────────
app.get("/test-db", async (_req, res) => {
  try {
    const { supabase } = await import("./supabase.js");
    const { data, error } = await supabase.from("profiles").select("count").limit(1);
    if (error) throw error;
    res.json({ ok: true, supabase: "connected" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT} 🚀`));

export default app;
