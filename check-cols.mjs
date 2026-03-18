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

const r1 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='profiles' ORDER BY ordinal_position");
console.log("profiles cols:", r1.rows.map(x => x.column_name).join(", "));

const r2 = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
console.log("tables:", r2.rows.map(x => x.table_name).join(", "));

const r3 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' OR table_name='User' ORDER BY ordinal_position");
console.log("users cols:", r3.rows.map(x => x.column_name).join(", "));

c.release();
await pool.end();
