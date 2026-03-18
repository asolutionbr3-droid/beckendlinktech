import pg from "pg";
import fs from "fs";

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
const c = await pool.connect();

const r1 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='serviços' ORDER BY ordinal_position");
console.log("serviços cols:", r1.rows.map(x => x.column_name).join(", "));

const r2 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='links' ORDER BY ordinal_position");
console.log("links cols:", r2.rows.map(x => x.column_name).join(", "));

// Mostra usuário criado anteriormente
const r3 = await c.query("SELECT id, name, email FROM users WHERE email='teste@techlink.com'");
console.log("user existente:", r3.rows[0] ? JSON.stringify(r3.rows[0]) : "nenhum");

c.release();
await pool.end();
