import dotenv from "dotenv";
import pkg from "pg";
import bcrypt from "bcrypt";
import { v4 as uuid } from "uuid";

dotenv.config();

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log("Conectando ao Railway...\n");

    // ── Dados do usuário de teste ────────────────────────────────────────────
    const email    = "teste@techlink.com";
    const password = "teste123";
    const nome     = "Carlos Teste";
    const slug     = "carlosteste";

    // Remover se já existir (limpeza)
    await client.query("DELETE FROM links    WHERE slug = $1",         [slug]);
    await client.query("DELETE FROM profiles WHERE nome = $1",         [nome]);
    await client.query("DELETE FROM users    WHERE email = $1",        [email]);

    // ── Criar usuário ────────────────────────────────────────────────────────
    const userId = uuid();
    const hash   = await bcrypt.hash(password, 10);

    await client.query(
      `INSERT INTO users (id, name, email, password, role, plan)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, "carlosteste", email, hash, "user", "free"]
    );
    console.log("✓ Usuário criado");
    console.log(`  id:    ${userId}`);
    console.log(`  email: ${email}`);
    console.log(`  senha: ${password}`);

    // ── Criar perfil ─────────────────────────────────────────────────────────
    const profileId = uuid();
    await client.query(
      `INSERT INTO profiles
         (id, user_id, nome, display_name, uber, app99, eletrico, cidade, whatsapp, pix, foto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        profileId,
        userId,
        nome,                          // nome completo
        "Carlos 🚗",                   // display_name
        true,                          // uber
        true,                          // app99
        false,                         // eletrico
        "São Paulo - SP",              // cidade
        "11999990000",                 // whatsapp
        "carlosteste@nubank.com.br",   // pix
        "",                            // foto (vazio por enquanto)
      ]
    );
    console.log("\n✓ Perfil criado");
    console.log(`  nome:        ${nome}`);
    console.log(`  display:     Carlos 🚗`);
    console.log(`  cidade:      São Paulo - SP`);
    console.log(`  whatsapp:    11999990000`);
    console.log(`  pix:         carlosteste@nubank.com.br`);
    console.log(`  uber:        true | app99: true`);

    // ── Criar link/slug ──────────────────────────────────────────────────────
    const linkId = uuid();
    await client.query(
      `INSERT INTO links (id, user_id, slug) VALUES ($1,$2,$3)`,
      [linkId, userId, slug]
    );
    console.log(`\n✓ Link criado`);
    console.log(`  slug: /${slug}`);

    // ── Criar serviços de exemplo ────────────────────────────────────────────
    const servicos = [
      { titulo: "Uber",       url: "https://uber.com",      icon: "🚗", color: "#000000", pos: 0 },
      { titulo: "99App",      url: "https://99app.com",     icon: "🟡", color: "#FFD700", pos: 1 },
      { titulo: "WhatsApp",   url: "https://wa.me/11999990000", icon: "💬", color: "#25D366", pos: 2 },
      { titulo: "Instagram",  url: "https://instagram.com/carlosteste", icon: "📸", color: "#E1306C", pos: 3 },
      { titulo: "Pix",        url: "",                      icon: "💸", color: "#4CAF50", pos: 4 },
    ];

    for (const s of servicos) {
      await client.query(
        `INSERT INTO "serviços" (id, user_id, "titulo do botão", link_url, numero, icon, color, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [uuid(), userId, s.titulo, s.url, "", s.icon, s.color, s.pos]
      );
    }
    console.log(`\n✓ ${servicos.length} serviços criados`);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ Seed concluído! Use para logar:");
    console.log(`   Email: ${email}`);
    console.log(`   Senha: ${password}`);
    console.log(`   Slug:  /${slug}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  } catch (err) {
    console.error("❌ Erro:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
