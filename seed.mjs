import pg from "pg";
import { randomUUID } from "crypto";
import fs from "fs";

// Lê .env
const lines = fs.readFileSync(".env", "utf8").split("\n");
for (const l of lines) {
  const t = l.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[k]) process.env[k] = v;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  // ─── Verifica usuário existente ─────────────────────────────────
  const userRow = await client.query(
    "SELECT id FROM users WHERE email = $1",
    ["teste@techlink.com"]
  );

  const userId = userRow.rows[0]?.id ?? randomUUID();
  console.log("👤 UserID:", userId);

  // ─── 1. Perfil ───────────────────────────────────────────────────
  await client.query("DELETE FROM profiles WHERE user_id = $1", [userId]);
  await client.query(
    `INSERT INTO profiles (id, user_id, nome, display_name, uber, app99, eletrico, cidade, whatsapp, pix, foto)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      randomUUID(),
      userId,
      "Carlos Teste",
      "Carlos Motorista Pro",
      true,
      true,
      false,
      "São Paulo - SP",
      "5511999887766",
      "carlos.pix@techlink.com",
      "https://i.pravatar.cc/150?u=carlosteste",
    ]
  );
  console.log("✅ Perfil criado");

  // ─── 2. Link / Slug ──────────────────────────────────────────────
  await client.query("DELETE FROM links WHERE user_id = $1", [userId]);
  await client.query(
    "INSERT INTO links (id, user_id, slug) VALUES ($1, $2, $3)",
    [randomUUID(), userId, "carlosteste"]
  );
  console.log("✅ Link criado: /view/carlosteste");

  // ─── 3. Serviços (5 botões) — tabela real: "serviços" ───────────
  await client.query(`DELETE FROM "serviços" WHERE user_id = $1`, [userId]);

  const services = [
    { titulo: "WhatsApp",  url: "https://wa.me/5511999887766",             icon: "💬", color: "#25D366", position: 0 },
    { titulo: "Uber",      url: "https://m.uber.com/ul/",                   icon: "🚗", color: "#000000", position: 1 },
    { titulo: "99App",     url: "https://99app.com",                        icon: "🟡", color: "#FFD600", position: 2 },
    { titulo: "Instagram", url: "https://instagram.com/carlosteste",        icon: "📸", color: "#E1306C", position: 3 },
    { titulo: "Pix",       url: "https://nubank.com.br/cobrar/carlos/link", icon: "💳", color: "#8A05BE", position: 4 },
  ];

  for (const s of services) {
    await client.query(
      `INSERT INTO "serviços" (id, user_id, "titulo do botão", link_url, icon, color, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), userId, s.titulo, s.url, s.icon, s.color, s.position]
    );
  }
  console.log("✅ 5 serviços inseridos na tabela \"serviços\"");

  console.log("\n=============================");
  console.log("🚀 Seed concluído com sucesso!");
  console.log("  Email:  teste@techlink.com");
  console.log("  Senha:  teste123");
  console.log("  Slug:   /view/carlosteste");
  console.log("  UserID:", userId);
  console.log("=============================");

} catch (err) {
  console.error("❌ Erro:", err.message);
  console.error(err.detail ?? "");
} finally {
  client.release();
  await pool.end();
}
