import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { v4 as uuid } from "uuid";
import { OAuth2Client } from "google-auth-library";
import nodemailer from "nodemailer";
import crypto from "crypto";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENTE_ID);

const router = express.Router();

function isBcryptHash(str) {
  return typeof str === "string" && /^\$2[ab]\$\d+\$/.test(str);
}

function getMailTransport() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

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

  if (!user.rows.length) return res.status(401).json({ error: "Usuário não encontrado" });

  const storedPassword = user.rows[0].password;

  // Senha em texto puro (usuários antigos inseridos sem bcrypt)
  if (!isBcryptHash(storedPassword)) {
    return res.status(401).json({
      error: "Sua senha precisa ser redefinida. Use 'Recuperar senha' para criar uma nova.",
    });
  }

  const valid = await bcrypt.compare(password, storedPassword);
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

// ── Esqueci minha senha ─────────────────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email obrigatório" });

  try {
    const userRes = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    // Sempre responde 200 para não expor se o email existe
    if (!userRes.rows.length) {
      return res.json({ ok: true, message: "Se o email existir, você receberá um link de recuperação." });
    }

    const userId = userRes.rows[0].id;
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

    // Garante que a tabela de tokens existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN NOT NULL DEFAULT false
      )
    `);

    // Remove tokens anteriores do mesmo usuário
    await pool.query("DELETE FROM password_reset_tokens WHERE user_id=$1", [userId]);

    await pool.query(
      "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)",
      [userId, token, expiresAt]
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetLink = `${frontendUrl}/recuperar-senha?token=${token}`;

    const transporter = getMailTransport();
    if (transporter) {
      await transporter.sendMail({
        from: `"TechLink" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Recuperação de senha – TechLink",
        html: `
          <p>Olá!</p>
          <p>Você solicitou a recuperação de senha. Clique no link abaixo para criar uma nova senha:</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          <p>Este link expira em 1 hora.</p>
          <p>Se não foi você, ignore este email.</p>
        `,
      });
    } else {
      // Sem email configurado: exibe link no console (dev)
      console.log("⚠️  EMAIL não configurado. Link de reset:", resetLink);
    }

    res.json({ ok: true, message: "Se o email existir, você receberá um link de recuperação." });
  } catch (err) {
    console.error("Erro forgot-password:", err);
    res.status(500).json({ error: "Erro ao processar solicitação" });
  }
});

// ── Redefinir senha com token ────────────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: "Token e senha são obrigatórios" });
  if (password.length < 6) return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN NOT NULL DEFAULT false
      )
    `);

    const tokenRes = await pool.query(
      "SELECT * FROM password_reset_tokens WHERE token=$1 AND used=false AND expires_at > NOW()",
      [token]
    );

    if (!tokenRes.rows.length) {
      return res.status(400).json({ error: "Token inválido ou expirado. Solicite um novo link." });
    }

    const { user_id } = tokenRes.rows[0];
    const hash = await bcrypt.hash(password, 10);

    await pool.query("UPDATE users SET password=$1 WHERE id=$2", [hash, user_id]);
    await pool.query("UPDATE password_reset_tokens SET used=true WHERE token=$1", [token]);

    res.json({ ok: true, message: "Senha redefinida com sucesso!" });
  } catch (err) {
    console.error("Erro reset-password:", err);
    res.status(500).json({ error: "Erro ao redefinir senha" });
  }
});

export default router;
