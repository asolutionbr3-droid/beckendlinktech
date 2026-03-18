import path from "node:path";
import fs from "node:fs";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Lê .env manualmente de forma síncrona
try {
  const envPath = path.join(process.cwd(), ".env");
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const DB_URL = process.env.DATABASE_URL!;

export default defineConfig({
  earlyAccess: true,
  schema: path.join("prisma", "schema.prisma"),

  datasource: {
    url: DB_URL,
  },

  migrate: {
    async adapter(env) {
      const pool = new Pool({
        connectionString: env.DATABASE_URL ?? DB_URL,
        ssl: { rejectUnauthorized: false },
      });
      return new PrismaPg(pool);
    },
  },

  studio: {
    async adapter(env) {
      const pool = new Pool({
        connectionString: env.DATABASE_URL ?? DB_URL,
        ssl: { rejectUnauthorized: false },
      });
      return new PrismaPg(pool);
    },
  },
});
