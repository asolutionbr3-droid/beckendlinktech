import express from "express";
import { supabase } from "../supabase.js";
import { v4 as uuid } from "uuid";

const router = express.Router();

// Salvar perfil
router.post("/profile", async (req, res) => {
  try {
    const { user_id, nome, displayName, uber, app99, eletrico, cidade, whatsapp, pix, foto } = req.body;

    const { data: linkRow } = await supabase
      .from("links")
      .select("slug")
      .eq("user_id", user_id)
      .single();

    const slug = linkRow?.slug || "";
    const link_publico = slug ? `https://techlinks.app/${slug}` : "";

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user_id);

    if (existing?.length) {
      await supabase
        .from("profiles")
        .update({ nome, display_name: displayName, uber, app99, eletrico, cidade, whatsapp, pix, foto, link_publico, updated_at: new Date().toISOString() })
        .eq("user_id", user_id);
    } else {
      await supabase
        .from("profiles")
        .insert({ id: uuid(), user_id, nome, display_name: displayName, uber, app99, eletrico, cidade, whatsapp, pix, foto, link_publico });
    }

    res.json({ success: true, message: "Perfil salvo com sucesso!" });
  } catch (error) {
    console.error("Erro ao salvar perfil:", error);
    res.status(500).json({ success: false, message: "Erro ao salvar perfil" });
  }
});

// Buscar perfil
router.get("/profile/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (!data) return res.json({ success: false, message: "Perfil não encontrado" });
    res.json({ success: true, profile: data });
  } catch (error) {
    console.error("Erro ao buscar perfil:", error);
    res.status(500).json({ success: false, message: "Erro ao buscar perfil" });
  }
});

// Buscar slug do usuário
router.get("/slug/:user_id", async (req, res) => {
  try {
    const { data } = await supabase
      .from("links")
      .select("slug")
      .eq("user_id", req.params.user_id)
      .single();

    res.json({ slug: data?.slug || null });
  } catch (error) {
    res.status(500).json({ slug: null });
  }
});

// Atualizar slug
router.put("/update-slug", async (req, res) => {
  try {
    const { user_id, slug } = req.body;

    if (!slug || !/^[a-z0-9_-]{3,30}$/.test(slug)) {
      return res.status(400).json({ success: false, message: "Slug inválido. Use apenas letras minúsculas, números, hífen ou underline (3–30 caracteres)." });
    }

    const { data: existing } = await supabase
      .from("links")
      .select("user_id")
      .eq("slug", slug);

    if (existing?.length && existing[0].user_id !== user_id) {
      return res.status(409).json({ success: false, message: "Este slug já está em uso." });
    }

    await supabase.from("links").update({ slug }).eq("user_id", user_id);
    res.json({ success: true, slug });
  } catch (error) {
    console.error("Erro ao atualizar slug:", error);
    res.status(500).json({ success: false, message: "Erro ao atualizar slug" });
  }
});

// Gerar link único
router.post("/generate-link", async (req, res) => {
  try {
    const { user_id } = req.body;
    const { data: existing } = await supabase
      .from("links")
      .select("slug")
      .eq("user_id", user_id)
      .single();

    const slug = existing?.slug || Math.random().toString(36).substring(2, 8);

    if (!existing) {
      await supabase.from("links").insert({ id: uuid(), user_id, slug });
    }

    res.json({ success: true, link: `https://techlinks.app/${slug}`, slug });
  } catch (error) {
    console.error("Erro ao gerar link:", error);
    res.status(500).json({ success: false, message: "Erro ao gerar link" });
  }
});

// Adicionar serviço
router.post("/services", async (req, res) => {
  try {
    const { user_id, title, url, numero, icon, color, order } = req.body;
    const servico = url ? `${title} | ${url}` : title;

    await supabase.from("servicos").insert({
      id: uuid(),
      user_id,
      title,
      url: url || "",
      servico,
      numero: numero || "",
      icon: icon || "🔗",
      color: color || "#4CAF50",
      position: order || 0,
    });

    res.json({ success: true, message: "Serviço adicionado" });
  } catch (error) {
    console.error("Erro ao adicionar serviço:", error);
    res.status(500).json({ success: false, message: "Erro ao adicionar serviço" });
  }
});

// Listar serviços
router.get("/services/:user_id", async (req, res) => {
  try {
    const { data } = await supabase
      .from("servicos")
      .select("*")
      .eq("user_id", req.params.user_id)
      .order("position", { ascending: true });

    res.json({ success: true, services: data || [] });
  } catch (error) {
    console.error("Erro ao buscar serviços:", error);
    res.status(500).json({ success: false, message: "Erro ao buscar serviços" });
  }
});

// Atualizar serviço
router.put("/services/:id", async (req, res) => {
  try {
    const { title, url, numero, icon, color, order } = req.body;
    const servico = url ? `${title} | ${url}` : title;

    await supabase.from("servicos").update({
      title,
      url: url || "",
      servico,
      numero: numero || "",
      icon,
      color,
      position: order ?? 0,
    }).eq("id", req.params.id);

    res.json({ success: true, message: "Serviço atualizado" });
  } catch (error) {
    console.error("Erro ao atualizar serviço:", error);
    res.status(500).json({ success: false, message: "Erro ao atualizar serviço" });
  }
});

// Deletar serviço
router.delete("/services/:id", async (req, res) => {
  try {
    await supabase.from("servicos").delete().eq("id", req.params.id);
    res.json({ success: true, message: "Serviço excluído" });
  } catch (error) {
    console.error("Erro ao excluir serviço:", error);
    res.status(500).json({ success: false, message: "Erro ao excluir serviço" });
  }
});

// Perfil público por slug
router.get("/public/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const { data: linkData } = await supabase
      .from("links")
      .select("*")
      .eq("slug", slug)
      .single();

    if (!linkData) return res.json({ success: false, message: "Link não encontrado" });

    const [{ data: profile }, { data: profileMeta }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", linkData.user_id).single(),
      supabase.from("profiles").select("plan, theme").eq("user_id", linkData.user_id).single(),
    ]);

    if (!profile) return res.json({ success: false, message: "Perfil não encontrado" });

    const plan = profileMeta?.plan || "free";
    const limit = plan === "premium" ? 15 : 5;

    const { data: services } = await supabase
      .from("servicos")
      .select("*")
      .eq("user_id", linkData.user_id)
      .order("position", { ascending: true })
      .limit(limit);

    res.json({
      success: true,
      plan,
      theme: linkData.theme || profileMeta?.theme || "green-pro",
      is_premium: linkData.is_premium || false,
      qr_enabled: linkData.qr_enabled || false,
      verified: linkData.verified || false,
      custom_color: linkData.custom_color || null,
      profile: { ...profile, plan, theme: profileMeta?.theme },
      services: services || [],
    });
  } catch (error) {
    console.error("Erro ao buscar perfil público:", error);
    res.status(500).json({ success: false, message: "Erro ao buscar perfil" });
  }
});

// Atualizar configurações do link (tema, qr, cor)
router.put("/link-settings", async (req, res) => {
  try {
    const { user_id, theme, qr_enabled, custom_color } = req.body;

    const update = { updated_at: new Date().toISOString() };
    if (theme !== undefined) update.theme = theme;
    if (qr_enabled !== undefined) update.qr_enabled = qr_enabled;
    if (custom_color !== undefined) update.custom_color = custom_color;

    await supabase.from("links").update(update).eq("user_id", user_id);
    res.json({ success: true, message: "Configurações do link atualizadas" });
  } catch (error) {
    console.error("Erro ao atualizar link-settings:", error);
    res.status(500).json({ success: false, message: "Erro ao atualizar configurações" });
  }
});

// Ativar premium
router.post("/activate-premium", async (req, res) => {
  try {
    const { user_id } = req.body;

    await supabase.from("profiles").update({ plan: "premium" }).eq("user_id", user_id);
    await supabase.from("links").update({ is_premium: true, verified: true, updated_at: new Date().toISOString() }).eq("user_id", user_id);

    res.json({ success: true, message: "Premium ativado" });
  } catch (error) {
    console.error("Erro ao ativar premium:", error);
    res.status(500).json({ success: false, message: "Erro ao ativar premium" });
  }
});

export default router;
