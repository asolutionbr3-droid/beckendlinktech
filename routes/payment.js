import express from "express";
import Stripe from "stripe";
import { supabase } from "../supabase.js";

const router = express.Router();

let _stripe;
const getStripe = () => {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY não configurada");
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
};

// Criar sessão de checkout
router.post("/create-checkout", async (req, res) => {
  try {
    const { userId, theme } = req.body;
    if (!userId) return res.status(400).json({ error: "userId obrigatório" });

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      metadata: { userId, theme: theme || "dark-night" },
      success_url: `${process.env.FRONTEND_URL}/dashboard/premium-user?success=1&theme=${theme || "dark-night"}`,
      cancel_url:  `${process.env.FRONTEND_URL}/dashboard/premium?canceled=1`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Erro ao criar checkout:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Webhook do Stripe
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook inválido:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { userId, theme } = session.metadata || {};
    const email = session.customer_details?.email || session.customer_email;

    try {
      if (userId) {
        await supabase
          .from("profiles")
          .update({ plan: "premium", theme: theme || "dark-night" })
          .eq("user_id", userId);

        await supabase
          .from("links")
          .update({ is_premium: true, verified: true })
          .eq("user_id", userId);

        console.log(`✓ Usuário ${userId} agora é premium | tema: ${theme}`);
      } else if (email) {
        // Payment Link estático — identificar por email via auth.users
        const { data: authUser } = await supabase.auth.admin.getUserByEmail(email);

        if (authUser?.user?.id) {
          await supabase
            .from("profiles")
            .update({ plan: "premium" })
            .eq("user_id", authUser.user.id);

          await supabase
            .from("links")
            .update({ is_premium: true, verified: true })
            .eq("user_id", authUser.user.id);

          console.log(`✓ Usuário ${email} ativado como premium via Payment Link`);
        } else {
          console.warn(`⚠️ Pagamento recebido mas email ${email} não encontrado`);
        }
      }
    } catch (err) {
      console.error("Erro ao atualizar plano:", err.message);
    }
  }

  res.json({ received: true });
});

// Salvar tema
router.post("/save-theme", async (req, res) => {
  try {
    const { userId, theme } = req.body;
    await supabase.from("profiles").update({ theme }).eq("user_id", userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar plano e tema
router.get("/plan/:userId", async (req, res) => {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("plan, theme")
      .eq("user_id", req.params.userId)
      .single();

    if (!data) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json({ plan: data.plan || "free", theme: data.theme || "green-pro" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
