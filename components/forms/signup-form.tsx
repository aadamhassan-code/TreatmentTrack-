"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { CheckoutPlan, BillingInterval } from "@/lib/types";

const planCopy: Record<CheckoutPlan, { label: string; monthly: number; annual: number }> = {
  solo: { label: "Solo", monthly: 99, annual: 82 },
  practice: { label: "Practice", monthly: 199, annual: 165 },
  multisite: { label: "Multisite", monthly: 399, annual: 332 },
};

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const plan = (searchParams.get("plan") as CheckoutPlan) || "practice";
  const interval = (searchParams.get("interval") as BillingInterval) || "monthly";
  const canceled = searchParams.get("canceled");

  // "associate": a dentist signing up to follow up their own quotes at a
  // practice they don't own. Nothing is sent until the owner approves.
  const [accountType, setAccountType] = useState<"practice" | "associate">(
    searchParams.get("as") === "dentist" ? "associate" : "practice"
  );
  const [practiceName, setPracticeName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = planCopy[plan]?.[interval] ?? planCopy.practice.monthly;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ practiceName, ownerName, email, plan, interval, accountType }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
        Step 1 of 2
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium text-ink-900">
        Set up {planCopy[plan]?.label ?? "Practice"}
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        £{price}/month, billed {interval}. You&rsquo;ll pay on the next
        screen — your account activates the moment payment succeeds.
      </p>

      {canceled && (
        <p className="mt-4 rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">
          Checkout was canceled — no charge was made. Pick up where you left
          off below.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink-900">I&rsquo;m signing up as</legend>
          {(
            [
              ["practice", "The practice owner or manager", "Follow up quotes for the whole practice."],
              [
                "associate",
                "A dentist at a practice I don't own",
                "Follow up your own patients' quotes. Messages go out in the practice's name, so the practice owner approves this before anything is sent.",
              ],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className={`flex cursor-pointer gap-3 rounded-lg border px-4 py-3 text-sm ${accountType === value ? "border-teal-700 bg-teal-50" : "border-ink-900/10"}`}
            >
              <input
                type="radio"
                name="accountType"
                value={value}
                checked={accountType === value}
                onChange={() => setAccountType(value)}
                className="mt-0.5 h-4 w-4 accent-teal-700"
              />
              <span>
                <span className="block font-medium text-ink-900">{label}</span>
                <span className="block text-ink-500">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div>
          <label className="block text-sm font-medium text-ink-900" htmlFor="practiceName">
            {accountType === "associate"
              ? "The practice you work at"
              : plan === "solo"
                ? "Practice or trading name"
                : "Practice name"}
          </label>
          <input
            id="practiceName"
            required
            value={practiceName}
            onChange={(e) => setPracticeName(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
            placeholder={plan === "solo" ? "Priya Shah Dental" : "Riverside Dental"}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-900" htmlFor="ownerName">
            Your name
          </label>
          <input
            id="ownerName"
            required
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
            placeholder="Priya Shah"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-900" htmlFor="email">
            Work email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
            placeholder="priya@riversidedental.co.uk"
          />
          <p className="mt-1.5 text-xs text-ink-500">
            We&rsquo;ll email you a link to set your password once payment
            succeeds.
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{error}</p>
        )}

        <Button type="submit" disabled={loading} className="w-full" size="lg">
          {loading ? "Redirecting to secure checkout…" : "Continue to payment"}
        </Button>
        <p className="text-center text-xs text-ink-500">
          Not the right plan?{" "}
          <button
            type="button"
            onClick={() => router.push("/pricing")}
            className="underline hover:text-teal-800"
          >
            Compare plans
          </button>
        </p>
      </form>
    </div>
  );
}
