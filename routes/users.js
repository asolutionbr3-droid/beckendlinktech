import express from "express";
import { pool } from "../db.js";
import { v4 as uuid } from "uuid";

const router = express.Router();

// Salvar dados do perfil
router.post("/profile", async (req, res) => {
  try {
    const { 
      user_id, 
      nome, 
      displayName, 
      uber, 
      app99, 
      eletrico, 
      cidade, 
      whatsapp, 
      pix, 
      foto 
    } = req.body;

    // Verificar se já existe perfil para este usuário
    const existingProfile = await pool.query(
      "SELECT id FROM profiles WHERE user_id = $1",
      [user_id]
    );

    if (existingProfile.rows.length > 0) {
      // Atualizar perfil existente
      await pool.query(
        `UPDATE profiles SET 
         nome = $1, display_name = $2, uber = $3, app99 = $4, eletrico = $5,
         cidade = $6, whatsapp = $7, pix = $8, foto = $9, updated_at = NOW()
         WHERE user_id = $10`,
        [nome, displayName, uber, app99, eletrico, cidade, whatsapp, pix, foto, user_id]
      );
    } else {
      // Criar novo perfil
      await pool.query(
        `INSERT INTO profiles 
         (id, user_id, nome, display_name, uber, app99, eletrico, cidade, whatsapp, pix, foto)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [uuid(), user_id, nome, displayName, uber, app99, eletrico, cidade, whatsapp, pix, foto]
      );
    }

    res.json({ success: true, message: "Perfil salvo com sucesso!" });
  } catch (error) {
    console.error("Erro ao salvar perfil:", error);
    res.status(500).json({ success: false, message: "Erro ao salvar perfil" });
  }
});

// Buscar dados do perfil
router.get("/profile/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    
    const result = await pool.query(
      "SELECT * FROM profiles WHERE user_id = $1",
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.json({ success: false, message: "Perfil não encontrado" });
    }

    res.json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error("Erro ao buscar perfil:", error);
    res.status(500).json({ success: false, message: "Erro ao buscar perfil" });
  }
});

// Gerar link único para usuário
router.post("/generate-link", async (req, res) => {
  try {
    const { user_id } = req.body;
    
    // Verificar se já existe link
    const existingLink = await pool.query(
      "SELECT slug FROM links WHERE user_id = $1",
      [user_id]
    );
    
    let slug;
    
    if (existingLink.rows.length > 0) {
      slug = existingLink.rows[0].slug;
    } else {
      // Gerar slug único
      slug = Math.random().toString(36).substring(2, 8);
      await pool.query(
        "INSERT INTO links (id, user_id, slug) VALUES ($1,$2,$3)",
        [uuid(), user_id, slug]
      );
    }

    res.json({ 
      success: true, 
      link: `https://techlinks.app/${slug}`,
      slug: slug 
    });
  } catch (error) {
    console.error("Erro ao gerar link:", error);
    res.status(500).json({ success: false, message: "Erro ao gerar link" });
  }
});

// Atualizar slug do usuário
router.put("/update-slug", async (req, res) => {
  try {
    const { user_id, slug } = req.body;

    if (!slug || !/^[a-z0-9_-]{3,30}$/.test(slug)) {
      return res.status(400).json({
        success: false,
        message: "Slug inválido. Use apenas letras minúsculas, números, hífen ou underline (3–30 caracteres)."
      });
    }

    // Verificar se slug já está em uso por outro usuário
    const existing = await pool.query(
      "SELECT user_id FROM links WHERE slug = $1",
      [slug]
    );

    if (existing.rows.length > 0 && existing.rows[0].user_id !== user_id) {
      return res.status(409).json({ success: false, message: "Este slug já está em uso." });
    }

    await pool.query(
      "UPDATE links SET slug = $1 WHERE user_id = $2",
      [slug, user_id]
    );

    res.json({ success: true, slug });
  } catch (error) {
    console.error("Erro ao atualizar slug:", error);
    res.status(500).json({ success: false, message: "Erro ao atualizar slug" });
  }
});

// CRUD para serviços customizados
router.post("/services", async (req, res) => {
  try {
    const { user_id, title, url, numero, icon, color, order } = req.body;

    await pool.query(
      `INSERT INTO "serviços" (id, user_id, "titulo do botão", link_url, numero, icon, color, position)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [uuid(), user_id, title, url, numero || '', icon || '🔗', color || '#4CAF50', order || 0]
    );

    res.json({ success: true, message: "Serviço adicionado" });
  } catch (error) {
    console.error("Erro ao adicionar serviço:", error);
    res.status(500).json({ success: false, message: "Erro ao adicionar serviço" });
  }
});

router.get("/services/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      `SELECT id, user_id, "titulo do botão" AS title, link_url AS url, numero, icon, color, position
       FROM "serviços" WHERE user_id = $1 ORDER BY position ASC`,
      [user_id]
    );

    res.json({ success: true, services: result.rows });
  } catch (error) {
    console.error("Erro ao buscar serviços:", error);
    res.status(500).json({ success: false, message: "Erro ao buscar serviços" });
  }
});

router.put("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, url, numero, icon, color, order } = req.body;

    await pool.query(
      `UPDATE "serviços" SET "titulo do botão" = $1, link_url = $2, numero = $3,
       icon = $4, color = $5, position = $6 WHERE id = $7`,
      [title, url, numero || '', icon, color, order ?? 0, id]
    );

    res.json({ success: true, message: "Serviço atualizado" });
  } catch (error) {
    console.error("Erro ao atualizar serviço:", error);
    res.status(500).json({ success: false, message: "Erro ao atualizar serviço" });
  }
});

router.delete("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`DELETE FROM "serviços" WHERE id = $1`, [id]);

    res.json({ success: true, message: "Serviço excluído" });
  } catch (error) {
    console.error("Erro ao excluir serviço:", error);
    res.status(500).json({ success: false, message: "Erro ao excluir serviço" });
  }
});

// Buscar dados públicos pelo slug
router.get("/public/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    
    const profileResult = await pool.query(
      `SELECT p.*, u.plan FROM profiles p
       JOIN links l ON p.user_id = l.user_id
       JOIN users u ON u.id = p.user_id
       WHERE l.slug = $1`,
      [slug]
    );

    if (profileResult.rows.length === 0) {
      return res.json({ success: false, message: "Link não encontrado" });
    }

    const plan = profileResult.rows[0].plan || 'free';
    const limit = plan === 'premium' ? 15 : 5;

    const servicesResult = await pool.query(
      `SELECT id, user_id, "titulo do botão" AS title, link_url AS url, numero, icon, color, position
       FROM "serviços" WHERE user_id = $1 ORDER BY position ASC LIMIT $2`,
      [profileResult.rows[0].user_id, limit]
    );

    res.json({
      success: true,
      plan,
      profile: profileResult.rows[0],
      services: servicesResult.rows
    });
  } catch (error) {
    console.error("Erro ao buscar perfil público:", error);
    res.status(500).json({ success: false, message: "Erro ao buscar perfil" });
  }
});

export default router;
