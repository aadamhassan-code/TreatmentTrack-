"use client";

import { useState } from "react";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    monthly: 149,
    annual: 124,
    annualTotal: 1490,
    description:
      "For a single-site practice that wants declined quotes followed up properly.",
    features: [
      "Up to 60 active quoted treatments/month",
      "SMS + email follow-up sequences",
      "Day 3 / 7 / 14 / 30 automated sequence",
      "Dual consent capture with timestamped audit trail",
      "1 practice location",
      "Email support",
    ],
  },
  {
    name: "Growth",
    monthly: 299,
    annual: 249,
    annualTotal: 2990,
    description:
      "For multi-chair or multi-site practices that also want compliant cross-sell.",
    features: [
      "Unlimited active quoted treatments",
      "SMS + WhatsApp + email",
      "Everything in Starter",
      "Cross-sell suggestion engine from Log Visit",
      "Up to 3 practice locations",
      "Priority support",
    ],
    highlight: true,
  },
];

export function PricingTable() {
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-center gap-3">
        <span
          className={cn(
            "text-sm font-medium",
            !annual ? "text-ink-900" : "text-ink-500"
          )}
        >
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          onClick={() => setAnnual((v) => !v)}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            annual ? "bg-teal-700" : "bg-ink-900/15"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-cream-0 shadow transition-transform",
              annual ? "translate-x-[22px]" : "translate-x-0.5"
            )}
          />
        </button>
        <span
          className={cn(
            "text-sm font-medium",
            annual ? "text-ink-900" : "text-ink-500"
          )}
        >
          Annual
        </span>
        <span className="rounded-full bg-gold-200 px-2 py-0.5 text-xs font-semibold text-gold-700">
          2 months free
        </span>
      </div>

      <div className="mx-auto mt-10 grid max-w-3xl gap-6 md:grid-cols-2">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={cn(
              plan.highlight && "border-teal-700 ring-1 ring-teal-700"
            )}
          >
            <CardBody>
              {plan.highlight && (
                <p className="mb-3 inline-flex rounded-full bg-teal-900 px-2.5 py-1 text-xs font-semibold text-cream-50">
                  Most practices choose this
                </p>
              )}
              <h3 className="font-display text-2xl font-medium text-ink-900">
                {plan.name}
              </h3>
              <p className="mt-1 text-sm text-ink-500">{plan.description}</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-mono text-4xl font-medium tabular-nums text-teal-900">
                  £{annual ? plan.annual : plan.monthly}
                </span>
                <span className="text-sm text-ink-500">/month</span>
              </div>
              {annual && (
                <p className="mt-1 text-xs text-ink-500">
                  Billed £{plan.annualTotal}/year
                </p>
              )}

              <LinkButton
                href={`/signup?plan=${plan.name.toLowerCase()}&interval=${
                  annual ? "annual" : "monthly"
                }`}
                variant={plan.highlight ? "primary" : "secondary"}
                className="mt-6 w-full"
              >
                Choose {plan.name}
              </LinkButton>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-ink-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
