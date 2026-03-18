import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import auth_routes from "./routes/auth.js";
import users from "./routes/users.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
}));
app.use(express.json());

// ─── Rotas existentes (JWT) ────────────────────────────────────────────────
app.use("/auth", auth_routes);
app.use("/user", users);

// ─── Better Auth ──────────────────────────────────────────────────────────
// Para ativar: cd backend && npm install better-auth
// Descomente as linhas abaixo após instalar:
//
// import { toNodeHandler } from "better-auth/node";
// import { auth } from "./src/lib/auth.js";
// app.all("/api/auth/*", toNodeHandler(auth));

app.listen(3333, () => console.log("API rodando na porta 3333 🚀"));
