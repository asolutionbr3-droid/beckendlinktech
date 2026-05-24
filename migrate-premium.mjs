import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migratePremium() {
  const client = await pool.connect();
  try {
    console.log("Conectando ao Railway...\n");
    await client.query("BEGIN");

    // Coluna theme na tabela users
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'dark-night';
    `);
    console.log("✓ Coluna theme em users");

    // Tabela premium_users
    await client.query(`
      CREATE TABLE IF NOT EXISTS premium_users (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        activated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        stripe_session  TEXT,
        theme           TEXT NOT NULL DEFAULT 'dark-night',
        active          BOOLEAN NOT NULL DEFAULT true
      );
    `);
    console.log("✓ Tabela premium_users criada");

    // Sincronizar usuários que já têm plan=premium
    await client.query(`
      INSERT INTO premium_users (user_id, theme)
      SELECT id, COALESCE(theme, 'dark-night')
      FROM users
      WHERE plan = 'premium'
      ON CONFLICT (user_id) DO NOTHING;
    `);
    console.log("✓ Usuários premium sincronizados");

    // Garantir coluna color em serviços (caso não exista)
    await client.query(`
      ALTER TABLE "serviços" ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#4CAF50';
    `);
    console.log("✓ Coluna color em serviços garantida");

    await client.query("COMMIT");
    console.log("\n✅ Migração premium concluída no Railway!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erro:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migratePremium();
