import { NextRequest, NextResponse } from "next/server";
import { stripe, PRICE_IDS, isStripeConfigured } from "@/lib/stripe";
import type { Plan, BillingInterval } from "@/lib/types";

/**
 * Creates a Stripe Checkout Session. Nothing about the practice is created
 * yet — the practice row and owner account only get provisioned by the
 * webhook once payment actually succeeds (see /api/stripe/webhook).
 */
export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe isn't connected yet. Add STRIPE_SECRET_KEY and price IDs to activate billing." },
      { status: 503 }
    );
  }

  const body = await request.json();
  const { practiceName, ownerName, email, plan, interval } = body as {
    practiceName?: string;
    ownerName?: string;
    email?: string;
    plan?: Plan;
    interval?: BillingInterval;
  };

  if (!practiceName || !ownerName || !email || !plan || !interval) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (plan !== "starter" && plan !== "growth") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  if (interval !== "monthly" && interval !== "annual") {
    return NextResponse.json({ error: "Invalid billing interval" }, { status: 400 });
  }

  const priceId = PRICE_IDS[plan][interval];
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe price configured for ${plan}/${interval}` },
      { status: 503 }
    );
  }

  const origin = request.nextUrl.origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/signup?plan=${plan}&interval=${interval}&canceled=1`,
    metadata: {
      practice_name: practiceName,
      owner_name: ownerName,
      owner_email: email,
      plan,
      interval,
    },
    subscription_data: {
      metadata: { plan, interval },
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Could not create checkout session" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
