import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Conectando ao banco Railway...");

    await client.query("BEGIN");

    // ── USERS ──────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          UUID PRIMARY KEY,
        name        TEXT NOT NULL,
        email       TEXT NOT NULL UNIQUE,
        password    TEXT NOT NULL,
        role        TEXT NOT NULL DEFAULT 'user',
        plan        TEXT NOT NULL DEFAULT 'free',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ Tabela users");

    // ── PROFILES ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id           UUID PRIMARY KEY,
        user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        nome         TEXT NOT NULL DEFAULT '',
        display_name TEXT NOT NULL DEFAULT '',
        uber         BOOLEAN NOT NULL DEFAULT false,
        app99        BOOLEAN NOT NULL DEFAULT false,
        eletrico     BOOLEAN NOT NULL DEFAULT false,
        cidade       TEXT NOT NULL DEFAULT '',
        whatsapp     TEXT NOT NULL DEFAULT '',
        pix          TEXT NOT NULL DEFAULT '',
        foto         TEXT NOT NULL DEFAULT '',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ Tabela profiles");

    // ── LINKS (slug) ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS links (
        id         UUID PRIMARY KEY,
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        slug       TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ Tabela links");

    // ── SERVIÇOS ────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS "serviços" (
        id               UUID PRIMARY KEY,
        user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "titulo do botão" TEXT NOT NULL DEFAULT '',
        link_url         TEXT NOT NULL DEFAULT '',
        numero           TEXT NOT NULL DEFAULT '',
        icon             TEXT NOT NULL DEFAULT '🔗',
        color            TEXT NOT NULL DEFAULT '#4CAF50',
        position         INTEGER NOT NULL DEFAULT 0,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ Tabela serviços");

    await client.query("COMMIT");
    console.log("\n✅ Migração concluída com sucesso no Railway!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erro na migração:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
