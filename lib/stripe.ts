import "server-only";
import Stripe from "stripe";
import type { CheckoutPlan, BillingInterval } from "@/lib/types";

// `||` not `??`: a blank STRIPE_SECRET_KEY= line (as copied from .env.example)
// must fall back too, or the Stripe SDK throws at build time.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2026-08-26.dahlia",
});

export const PRICE_IDS: Record<CheckoutPlan, Record<BillingInterval, string | undefined>> = {
  solo: {
    monthly: process.env.STRIPE_PRICE_SOLO_MONTHLY,
    annual: process.env.STRIPE_PRICE_SOLO_ANNUAL,
  },
  practice: {
    monthly: process.env.STRIPE_PRICE_PRACTICE_MONTHLY,
    annual: process.env.STRIPE_PRICE_PRACTICE_ANNUAL,
  },
  multisite: {
    monthly: process.env.STRIPE_PRICE_MULTISITE_MONTHLY,
    annual: process.env.STRIPE_PRICE_MULTISITE_ANNUAL,
  },
};

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      PRICE_IDS.solo.monthly &&
      PRICE_IDS.practice.monthly &&
      PRICE_IDS.multisite.monthly
  );
}

export function slugifyPracticeName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "practice"}-${suffix}`;
}
