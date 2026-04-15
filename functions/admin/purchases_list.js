import Stripe from "stripe";
import { requireCfAccessJwt } from "../_lib/cfAccess.js";

export async function onRequestGet({ env, request }) {
  const auth = await requireCfAccessJwt(request, env);
  if (!auth.ok) {
    return new Response(auth.message, { status: auth.status });
  }

  const url = new URL(request.url);
  const mode = (url.searchParams.get("mode") || "live").toLowerCase();

  const key =
    mode === "test" ? env.STRIPE_SECRET_KEY_TEST :
    env.STRIPE_SECRET_KEY_LIVE;

  if (!key) {
    return new Response(JSON.stringify({ error: `Stripe key missing for mode=${mode}` }), { status: 500 });
  }

  const stripe = new Stripe(key, { apiVersion: "2023-10-16" });

  const sessions = await stripe.checkout.sessions.list({
    limit: 25,
    expand: ["data.payment_intent"],
  });

  const rows = sessions.data
    .filter(s => s.status === "complete")
    .map(s => ({
      created: new Date(s.created * 1000).toISOString(),
      name: s.metadata?.customer_name ?? "",
      email: s.customer_email ?? "",
      license: s.metadata?.license_kind ?? "",
      amount: (s.amount_total ?? 0) / 100,
      currency: s.currency?.toUpperCase(),
      livemode: !!s.livemode,
      mode: s.livemode ? "Production" : "Sandbox",
      session_id: s.id,
      payment_intent: s.payment_intent?.id ?? "",
      dashboard_url: s.payment_intent?.id
	    ? `https://dashboard.stripe.com${s.livemode ? "" : "/test"}/payments/${s.payment_intent.id}`
		: ""
    }));

  return new Response(JSON.stringify(rows, null, 2), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}