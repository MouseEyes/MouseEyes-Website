import Stripe from "stripe";

export async function onRequestPost({ request, env }) {
  let body;

  // Debug: confirms whether the secret is available at runtime
  console.log("Stripe key present:", !!env.STRIPE_SECRET_KEY);

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    licenseKind,
    customerName,
    customerEmail,
    purchaseClickUtcIso,
    purchaseClickLocalDate,
  } = body;

  if (!licenseKind || !customerName || !customerEmail) {
    return Response.json(
      { error: "licenseKind, customerName, and customerEmail are required" },
      { status: 400 }
    );
  }

  const priceCents =
    licenseKind === "Yearly" ? 500 :
    licenseKind === "Lifetime" ? 2000 :
    null;

  if (!priceCents) {
    return Response.json({ error: "Invalid licenseKind" }, { status: 400 });
  }

  // ✅ Cloudflare/Workers-compatible Stripe client:
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    apiVersion: "2020-08-27",
  });

  // Dynamic base URL based on the incoming request host
  const baseUrl = new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail,
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: `MouseEyes ${licenseKind} License` },
        unit_amount: priceCents,
      },
      quantity: 1,
    }],
    metadata: {
      product: "MouseEyes",
      license_kind: licenseKind,
      customer_name: customerName,
      customer_email: customerEmail,
      ...(purchaseClickUtcIso ? { purchase_click_utc: String(purchaseClickUtcIso) } : {}),
      ...(purchaseClickLocalDate ? { purchase_click_local_date: String(purchaseClickLocalDate) } : {}),
    },
    success_url: `${baseUrl}/purchase-success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/purchase-cancelled.html`,
  });

  return Response.json({ url: session.url });
}