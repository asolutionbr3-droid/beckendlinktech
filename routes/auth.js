import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { v4 as uuid } from "uuid";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENTE_ID);

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

// ── Google OAuth ────────────────────────────────────────────────────────────
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body; // access_token vindo do frontend
    if (!credential) return res.status(400).json({ error: "Token ausente" });

    // Verificar access_token buscando userinfo no Google
    const googleRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${credential}` },
    });
    if (!googleRes.ok) return res.status(401).json({ error: "Token Google inválido" });

    const { email, name, picture, sub: googleId } = await googleRes.json();

    // Buscar ou criar usuário
    let userRow = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    let userId, userName;

    if (userRow.rows.length === 0) {
      // Criar novo usuário
      userId = uuid();
      userName = name || email.split("@")[0];
      const fakeHash = await bcrypt.hash(googleId + process.env.JWT_SECRET, 10);

      await pool.query(
        "INSERT INTO users (id, name, email, password, role) VALUES ($1,$2,$3,$4,$5)",
        [userId, userName, email, fakeHash, "user"]
      );

      // Criar perfil inicial
      await pool.query(
        `INSERT INTO profiles (id, user_id, nome, display_name, uber, app99, eletrico, cidade, whatsapp, pix, foto)
         VALUES ($1,$2,$3,$4,false,false,false,'','','','')`,
        [uuid(), userId, userName, userName]
      );

      // Gerar slug único
      const slug = userName.toLowerCase().replace(/[^a-z0-9]/g, '') + Math.random().toString(36).substring(2, 6);
      await pool.query(
        "INSERT INTO links (id, user_id, slug) VALUES ($1,$2,$3)",
        [uuid(), userId, slug]
      );
    } else {
      userId = userRow.rows[0].id;
      userName = userRow.rows[0].name;
    }

    // Buscar slug
    const linkResult = await pool.query("SELECT slug FROM links WHERE user_id = $1", [userId]);
    const slug = linkResult.rows[0]?.slug || null;

    const token = jwt.sign({ id: userId, role: "user" }, process.env.JWT_SECRET);

    res.json({
      ok: true,
      token,
      slug,
      user: { id: userId, name: userName, email, foto: picture || "" },
    });
  } catch (error) {
    console.error("Erro no login Google:", error);
    res.status(500).json({ error: "Falha ao autenticar com Google" });
  }
});

export default router;
