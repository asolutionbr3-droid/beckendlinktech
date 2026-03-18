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
const client = await pool.connect();

try {
  // Remove color, icon e numero (serão tratados via temas premium futuramente)
  await client.query(`ALTER TABLE "serviços" DROP COLUMN IF EXISTS color`);
  console.log("✅ Coluna 'color' removida");

  await client.query(`ALTER TABLE "serviços" DROP COLUMN IF EXISTS icon`);
  console.log("✅ Coluna 'icon' removida");

  await client.query(`ALTER TABLE "serviços" DROP COLUMN IF EXISTS numero`);
  console.log("✅ Coluna 'numero' removida");

  // Confirma colunas finais
  const r1 = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='serviços' ORDER BY ordinal_position"
  );
  console.log("\nColunas finais em \"serviços\":", r1.rows.map(x => x.column_name).join(", "));

  // Confirma dados
  const r2 = await client.query(`SELECT "titulo do botão", link_url, position FROM "serviços" ORDER BY position`);
  console.log("\nServiços cadastrados:");
  for (const s of r2.rows) {
    console.log(`  [${s.position}] ${s["titulo do botão"]} — ${s.link_url}`);
  }

} catch (err) {
  console.error("❌ Erro:", err.message);
} finally {
  client.release();
  await pool.end();
}
