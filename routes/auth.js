import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../db.js";
import { v4 as uuid } from "uuid";

const router = express.Router();

// ── Brevo: envio de email via REST API ───────────────────────────────────────
async function sendBrevoEmail({ to, toName, subject, html }) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key":     process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      "Accept":       "application/json",
    },
    body: JSON.stringify({
      sender:    { name: "TechLink", email: process.env.EMAIL_FROM || "noreply@driverstech.com" },
      to:        [{ email: to, name: toName || to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Brevo error:", err);
    return { error: err };
  }
  return { ok: true };
}

function isBcryptHash(str) {
  return typeof str === "string" && /^\$2[ab]\$\d+\$/.test(str);
}

// ── Cadastro ──────────────────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email e senha são obrigatórios" });

    const existing = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (existing.rows.length)
      return res.status(400).json({ error: "Email já cadastrado" });

    const name   = email.split("@")[0];
    const hash   = await bcrypt.hash(password, 10);
    const userId = uuid();

    await pool.query(
      "INSERT INTO users (id, name, email, password, role) VALUES ($1,$2,$3,$4,$5)",
      [userId, name, email, hash, "user"]
    );

    await pool.query(
      `INSERT INTO profiles (id, user_id, nome, display_name, uber, app99, eletrico, cidade, whatsapp, pix, foto)
       VALUES ($1,$2,$3,$4,false,false,false,'','','','')`,
      [uuid(), userId, name, name]
    );

    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "") + Math.random().toString(36).slice(2, 6);
    await pool.query(
      "INSERT INTO links (id, user_id, slug) VALUES ($1,$2,$3)",
      [uuid(), userId, slug]
    );

    const token = jwt.sign({ id: userId, role: "user" }, process.env.JWT_SECRET);
    res.json({ ok: true, token, user: { id: userId, name, email }, slug });
  } catch (err) {
    console.error("Erro no register:", err);
    res.status(500).json({ error: "Erro ao criar conta" });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email e senha são obrigatórios" });

    const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (!result.rows.length)
      return res.status(401).json({ error: "Usuário não encontrado" });

    const user           = result.rows[0];
    const storedPassword = user.password;

    if (!isBcryptHash(storedPassword))
      return res.status(401).json({
        error: "Sua senha precisa ser redefinida. Use 'Recuperar senha'.",
      });

    const valid = await bcrypt.compare(password, storedPassword);
    if (!valid)
      return res.status(401).json({ error: "Senha inválida" });

    const linkRow = await pool.query("SELECT slug FROM links WHERE user_id=$1", [user.id]);
    const slug    = linkRow.rows[0]?.slug || null;

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET);
    res.json({ token, slug, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ error: "Erro interno ao fazer login" });
  }
});

// ── Google OAuth ──────────────────────────────────────────────────────────────
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: "Token ausente" });

    console.log("[Google] Verificando token com Google userinfo...");
    const googleRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${credential}` },
    });
    if (!googleRes.ok) {
      const errText = await googleRes.text();
      console.error("[Google] Token inválido:", googleRes.status, errText);
      return res.status(401).json({ error: "Token Google inválido. Tente novamente." });
    }

    const { email, name, picture, sub: googleId } = await googleRes.json();

    let userRow = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    let userId, userName;

    if (!userRow.rows.length) {
      userId   = uuid();
      userName = name || email.split("@")[0];
      const fakeHash = await bcrypt.hash(googleId + process.env.JWT_SECRET, 10);

      await pool.query(
        "INSERT INTO users (id, name, email, password, role) VALUES ($1,$2,$3,$4,$5)",
        [userId, userName, email, fakeHash, "user"]
      );
      await pool.query(
        `INSERT INTO profiles (id, user_id, nome, display_name, uber, app99, eletrico, cidade, whatsapp, pix, foto)
         VALUES ($1,$2,$3,$4,false,false,false,'','','','')`,
        [uuid(), userId, userName, userName]
      );
      const slug = userName.toLowerCase().replace(/[^a-z0-9]/g, "") + Math.random().toString(36).slice(2, 6);
      await pool.query("INSERT INTO links (id, user_id, slug) VALUES ($1,$2,$3)", [uuid(), userId, slug]);
    } else {
      userId   = userRow.rows[0].id;
      userName = userRow.rows[0].name;
    }

    const linkRow = await pool.query("SELECT slug FROM links WHERE user_id=$1", [userId]);
    const slug    = linkRow.rows[0]?.slug || null;
    const token   = jwt.sign({ id: userId, role: "user" }, process.env.JWT_SECRET);

    res.json({ ok: true, token, slug, user: { id: userId, name: userName, email, foto: picture || "" } });
  } catch (err) {
    console.error("Erro no login Google:", err);
    res.status(500).json({ error: "Falha ao autenticar com Google" });
  }
});

// ── Esqueci minha senha ───────────────────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email obrigatório" });

  try {
    const userRes = await pool.query("SELECT id, name FROM users WHERE email=$1", [email]);

    // Responde 200 sempre (não revela se email existe)
    const OK = { ok: true, message: "Se o email existir, você receberá um link de recuperação." };

    if (!userRes.rows.length) return res.json(OK);

    const { id: userId, name } = userRes.rows[0];
    const token      = crypto.randomBytes(32).toString("hex");
    const expiresAt  = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Garante tabela existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token      TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used       BOOLEAN NOT NULL DEFAULT false
      )
    `);

    await pool.query("DELETE FROM password_reset_tokens WHERE user_id=$1", [userId]);
    await pool.query(
      "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)",
      [userId, token, expiresAt]
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetLink   = `${frontendUrl}/recuperar-senha?token=${token}`;
    // Responde IMEDIATAMENTE — não espera o email ser enviado
    res.json({ ok: true, message: "Link de recuperação enviado!" });

    // Envia email em background (fire-and-forget)
    sendBrevoEmail({
      to:      email,
      toName:  name || email,
      subject: "Recuperação de senha – TechLink",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;border-radius:16px;padding:0;overflow:hidden">
          <div style="background:linear-gradient(135deg,#4CAF50,#45a049);padding:32px 24px;text-align:center">
            <div style="font-size:40px">🔑</div>
            <h1 style="color:white;margin:12px 0 4px;font-size:22px">Recuperar Senha</h1>
            <p style="color:rgba(255,255,255,0.85);margin:0;font-size:14px">TechLink</p>
          </div>
          <div style="padding:32px 24px">
            <p style="color:#374151;font-size:15px;margin:0 0 8px">Olá, <strong>${name || "usuário"}</strong>!</p>
            <p style="color:#6b7280;font-size:14px;margin:0 0 24px">
              Recebemos uma solicitação para redefinir a senha da sua conta TechLink.
              Clique no botão abaixo para criar uma nova senha:
            </p>
            <a href="${resetLink}"
               style="display:block;background:linear-gradient(135deg,#4CAF50,#45a049);color:white;text-decoration:none;
                      padding:14px 24px;border-radius:12px;font-weight:bold;font-size:15px;text-align:center;margin-bottom:24px">
              Redefinir minha senha
            </a>
            <p style="color:#9ca3af;font-size:12px;margin:0">
              ⏱ Este link expira em <strong>1 hora</strong>.<br>
              Se você não solicitou isso, ignore este email — sua senha não será alterada.
            </p>
          </div>
          <div style="background:#f3f4f6;padding:16px 24px;text-align:center">
            <p style="color:#9ca3af;font-size:11px;margin:0">
              © TechLink · <a href="${frontendUrl}" style="color:#4CAF50;text-decoration:none">driverstech.com</a>
            </p>
          </div>
        </div>
      `,
    })
    .then(r => {
      if (r.error) console.error("Brevo error:", r.error);
      else console.log(`✓ Email de recuperação enviado via Brevo para ${email}`);
    })
    .catch(err => console.error("Brevo exception:", err));
  } catch (err) {
    console.error("Erro forgot-password:", err);
    res.status(500).json({ error: "Erro ao processar solicitação" });
  }
});

// ── Redefinir senha com token ─────────────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password)
    return res.status(400).json({ error: "Token e senha são obrigatórios" });
  if (password.length < 6)
    return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });

  try {
    const tokenRes = await pool.query(
      "SELECT * FROM password_reset_tokens WHERE token=$1 AND used=false AND expires_at > NOW()",
      [token]
    );

    if (!tokenRes.rows.length)
      return res.status(400).json({ error: "Token inválido ou expirado. Solicite um novo link." });

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
