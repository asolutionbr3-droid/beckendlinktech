import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { v4 as uuid } from "uuid";

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha são obrigatórios" });
    }

    // Verificar se email já existe
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Email já cadastrado" });
    }

    // Nome gerado automaticamente a partir do prefixo do e-mail
    const name = email.split("@")[0];

    const hash = await bcrypt.hash(password, 10);
    const userId = uuid();

    // Criar usuário
    await pool.query(
      "INSERT INTO users (id, name, email, password, role) VALUES ($1,$2,$3,$4,$5)",
      [userId, name, email, hash, "user"]
    );

    // Criar perfil inicial
    await pool.query(
      `INSERT INTO profiles (id, user_id, nome, display_name, uber, app99, eletrico, cidade, whatsapp, pix, foto)
       VALUES ($1, $2, $3, $4, false, false, false, '', '', '', '')`,
      [uuid(), userId, name, name]
    );

    // Gerar slug único automaticamente
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '') + Math.random().toString(36).substring(2, 6);
    await pool.query(
      "INSERT INTO links (id, user_id, slug) VALUES ($1, $2, $3)",
      [uuid(), userId, slug]
    );

    // Gerar token para login automático após cadastro
    const token = jwt.sign(
      { id: userId, role: "user" },
      process.env.JWT_SECRET
    );

    res.json({
      ok: true,
      token,
      user: { id: userId, name, email },
      slug
    });
  } catch (error) {
    console.error("Erro no registro:", error);
    res.status(500).json({ error: "Erro ao criar conta" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  if (!user.rows.length) return res.status(401).json({ error: "Usuário não existe" });

  const valid = await bcrypt.compare(password, user.rows[0].password);
  if (!valid) return res.status(401).json({ error: "Senha inválida" });

  // Buscar slug do usuário
  const linkResult = await pool.query(
    "SELECT slug FROM links WHERE user_id = $1",
    [user.rows[0].id]
  );
  const slug = linkResult.rows[0]?.slug || null;

  const token = jwt.sign(
    { id: user.rows[0].id, role: user.rows[0].role },
    process.env.JWT_SECRET
  );

  res.json({
    token,
    slug,
    user: {
      id: user.rows[0].id,
      name: user.rows[0].name,
      email: user.rows[0].email
    }
  });
});

export default router;
