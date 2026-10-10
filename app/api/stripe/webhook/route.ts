import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { slugifyPracticeName } from "@/lib/stripe";
import { createAdminClient, findAuthUserIdByEmail } from "@/lib/supabase/admin";
import type { Plan, BillingInterval } from "@/lib/types";

/**
 * The only place a practice is ever activated. Stripe Checkout collects
 * payment client-side, but nothing about the account is provisioned until
 * this webhook confirms `checkout.session.completed` — a client-side
 * redirect back to our own success page is never trusted on its own.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid signature: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata ?? {};
      const practiceName = metadata.practice_name;
      const ownerName = metadata.owner_name;
      const ownerEmail = metadata.owner_email ?? session.customer_details?.email;
      const plan = metadata.plan as Plan | undefined;
      const interval = metadata.interval as BillingInterval | undefined;
      const customerId = session.customer as string | null;
      const subscriptionId = session.subscription as string | null;
      // A dentist signing up at a practice they don't own: the account
      // can't send until that practice's owner approves it.
      const isAssociate = metadata.account_type === "associate";

      if (!practiceName || !ownerEmail || !plan || !interval || !subscriptionId) {
        console.error("checkout.session.completed missing required metadata", session.id);
        break;
      }

      // Idempotent and resumable: Stripe retries the webhook on any non-2xx
      // response, so each step below checks whether it already happened.
      // If the invite failed last time, the retry finishes the job instead
      // of stopping at "practice already exists".
      const { data: existing } = await supabase
        .from("practices")
        .select("id")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();

      let practiceId = existing?.id as string | undefined;

      if (!practiceId) {
        const { data: practice, error: practiceError } = await supabase
          .from("practices")
          .insert({
            name: practiceName,
            slug: slugifyPracticeName(practiceName),
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan,
            billing_interval: interval,
            status: "active",
            requires_owner_approval: isAssociate,
          })
          .select("id")
          .single();

        if (practiceError || !practice) {
          console.error("Failed to create practice", practiceError);
          return NextResponse.json({ error: "Failed to provision practice" }, { status: 500 });
        }
        practiceId = practice.id as string;
      }

      const { data: existingOwner } = await supabase
        .from("practice_members")
        .select("id")
        .eq("practice_id", practiceId)
        .limit(1)
        .maybeSingle();

      if (existingOwner) break;

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const { data: invite, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
        ownerEmail,
        {
          data: { full_name: ownerName },
          redirectTo: `${siteUrl}/login`,
        }
      );

      let ownerId = invite?.user?.id;
      if (!ownerId) {
        // The email may already have an account (e.g. an earlier attempt
        // got as far as the invite). Link that account instead.
        ownerId = (await findAuthUserIdByEmail(supabase, ownerEmail)) ?? undefined;
      }

      if (!ownerId) {
        console.error("Failed to invite owner", inviteError);
        return NextResponse.json({ error: "Failed to provision owner account" }, { status: 500 });
      }

      const { error: memberError } = await supabase.from("practice_members").insert({
        practice_id: practiceId,
        user_id: ownerId,
        role: "owner",
        display_name: isAssociate ? ownerName : null,
        treats_patients: isAssociate,
      });

      if (memberError) {
        console.error("Failed to link owner to practice", memberError);
        return NextResponse.json({ error: "Failed to link owner to practice" }, { status: 500 });
      }

      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const status =
        subscription.status === "active" || subscription.status === "trialing"
          ? "active"
          : subscription.status === "canceled" || subscription.status === "incomplete_expired"
            ? "canceled"
            : "past_due";
      await supabase
        .from("practices")
        .update({ status })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase
        .from("practices")
        .update({ status: "canceled" })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
