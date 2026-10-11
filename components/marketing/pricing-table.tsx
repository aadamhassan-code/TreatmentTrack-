"use client";

import { useState } from "react";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check, PhoneCall } from "lucide-react";

const plans = [
  {
    name: "Solo",
    monthly: 99,
    annual: 82,
    annualTotal: 990,
    description: "For an individual dentist following up their own quotes.",
    features: [
      "Up to 30 active quoted treatments/month",
      "SMS + email follow-up sequences",
      "Automated follow-up on your own schedule",
      "Dual consent capture with timestamped audit trail",
      "1 user login",
    ],
  },
  {
    name: "Practice",
    monthly: 199,
    annual: 165,
    annualTotal: 1990,
    description: "For a single practice with a full team.",
    features: [
      "Up to 150 active quoted treatments/month",
      "SMS + WhatsApp + email",
      "Everything in Solo",
      "Unlimited staff logins",
      "1 practice location",
    ],
    highlight: true,
  },
  {
    name: "Multisite",
    monthly: 399,
    annual: 332,
    annualTotal: 3990,
    description: "For groups running up to 5 practices.",
    features: [
      "Unlimited active quoted treatments",
      "Everything in Practice",
      "Cross-sell suggestion engine from Log Visit",
      "Up to 5 practice locations",
      "Priority support",
    ],
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

      <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
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

      <div className="mx-auto mt-6 max-w-5xl">
        <Card className="border-dashed">
          <CardBody className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <div>
              <h3 className="font-display text-xl font-medium text-ink-900">
                Running more than 5 practices?
              </h3>
              <p className="mt-1 text-sm text-ink-500">
                Group pricing, rollout support and a single billing
                arrangement across your sites — request a callback and
                we&rsquo;ll work out a price with you directly.
              </p>
            </div>
            <LinkButton href="/request-callback" variant="secondary" className="shrink-0">
              <PhoneCall className="h-4 w-4" />
              Request a callback
            </LinkButton>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
