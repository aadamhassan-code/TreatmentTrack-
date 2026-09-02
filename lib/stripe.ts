import "server-only";
import Stripe from "stripe";
import type { Plan, BillingInterval } from "@/lib/types";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2026-08-26.dahlia",
});

export const PRICE_IDS: Record<Plan, Record<BillingInterval, string | undefined>> = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    annual: process.env.STRIPE_PRICE_STARTER_ANNUAL,
  },
  growth: {
    monthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY,
    annual: process.env.STRIPE_PRICE_GROWTH_ANNUAL,
  },
};

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      PRICE_IDS.starter.monthly &&
      PRICE_IDS.growth.monthly
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
