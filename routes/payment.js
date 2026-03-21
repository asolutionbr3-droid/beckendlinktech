import express from "express";
import Stripe from "stripe";
import { pool } from "../db.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ── Criar sessão de checkout ─────────────────────────────────────────────────
router.post("/create-checkout", async (req, res) => {
  try {
    const { userId, theme } = req.body;
    if (!userId) return res.status(400).json({ error: "userId obrigatório" });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
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

// ── Webhook do Stripe ────────────────────────────────────────────────────────
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook inválido:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { userId, theme } = session.metadata;

    try {
      await pool.query(
        "UPDATE users SET plan = 'premium', theme = $1 WHERE id = $2",
        [theme || "dark-night", userId]
      );
      console.log(`✓ Usuário ${userId} agora é premium | tema: ${theme}`);
    } catch (err) {
      console.error("Erro ao atualizar plano:", err.message);
    }
  }

  res.json({ received: true });
});

// ── Salvar tema (usuário premium já pago) ────────────────────────────────────
router.post("/save-theme", async (req, res) => {
  try {
    const { userId, theme } = req.body;
    await pool.query("UPDATE users SET theme = $1 WHERE id = $2", [theme, userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Buscar plano e tema do usuário ───────────────────────────────────────────
router.get("/plan/:userId", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT plan, theme FROM users WHERE id = $1",
      [req.params.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json({ plan: result.rows[0].plan, theme: result.rows[0].theme || "green-pro" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
