"use client";

import { useActionState, useTransition, useState } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logVisit, type LogVisitResult } from "@/lib/actions/visits";
import type { VisitType } from "@/lib/types";

const VISIT_TYPES: { value: VisitType; label: string }[] = [
  { value: "hygiene", label: "Hygiene visit" },
  { value: "extraction", label: "Extraction" },
  { value: "other", label: "Other" },
];

const OUTCOME_COPY: Record<
  NonNullable<LogVisitResult["outcome"]>,
  { icon: typeof Info; className: string; title: string; body: string }
> = {
  no_suggestion: {
    icon: CheckCircle2,
    className: "bg-teal-50 text-teal-800 border-teal-700/20",
    title: "Visit logged",
    body: "No cross-sell suggestion was attached to this visit.",
  },
  suggestion_sent: {
    icon: CheckCircle2,
    className: "bg-teal-50 text-teal-800 border-teal-700/20",
    title: "Visit logged and suggestion recorded",
    body: "Cross-sell consent was on file for this patient, so the suggestion was allowed.",
  },
  blocked_no_consent: {
    icon: AlertTriangle,
    className: "bg-clay-100 text-clay-700 border-clay-500/30",
    title: "Visit logged — suggestion blocked",
    body: "This patient hasn't separately consented to cross-sell contact based on dental history, so no suggestion was created. This block cannot be overridden from this screen.",
  },
  blocked_disabled: {
    icon: AlertTriangle,
    className: "bg-ink-900/5 text-ink-700 border-ink-900/15",
    title: "Visit logged — cross-sell is off",
    body: "Cross-sell suggestions are turned off practice-wide in Settings, so none was created.",
  },
};

export function LogVisitForm() {
  const [state, formAction, pending] = useActionState<LogVisitResult, FormData>(
    async (_prev, formData) => logVisit(formData),
    {}
  );
  const [, startTransition] = useTransition();

  // Submit via onSubmit rather than the form's `action` prop so React
  // doesn't clear what was typed when the server returns an error.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  const [wantsSuggestion, setWantsSuggestion] = useState(false);

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink-900">Log a visit</h1>
        <p className="mt-2 text-sm text-ink-500">
          Hygiene and extraction visits can surface a further-treatment
          suggestion (whitening, implant) — but only if this patient has
          separately consented to it.
        </p>
      </div>

      <Card>
        <CardBody className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-ink-900" htmlFor="patientName">
                Patient name
              </label>
              <input
                id="patientName"
                name="patientName"
                required
                className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-900" htmlFor="phone">
                Mobile number
              </label>
              <input
                id="phone"
                name="phone"
                required
                className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-900" htmlFor="email">
              Email <span className="font-normal text-ink-500">(optional)</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-900" htmlFor="visitType">
              Visit type
            </label>
            <select
              id="visitType"
              name="visitType"
              required
              defaultValue=""
              className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
            >
              <option value="" disabled>
                Select a visit type
              </option>
              {VISIT_TYPES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium text-ink-900">
            <input
              type="checkbox"
              checked={wantsSuggestion}
              onChange={(e) => setWantsSuggestion(e.target.checked)}
              className="h-4 w-4 accent-teal-700"
            />
            This visit suggests a further treatment
          </label>

          {wantsSuggestion && (
            <div>
              <label
                className="block text-sm font-medium text-ink-900"
                htmlFor="suggestedTreatmentType"
              >
                Suggested treatment
              </label>
              <input
                id="suggestedTreatmentType"
                name="suggestedTreatmentType"
                className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                placeholder="Teeth whitening"
              />
              <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                We&rsquo;ll check this patient has separately consented to
                cross-sell contact before anything is sent — this can&rsquo;t
                be skipped.
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {state?.error && (
        <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{state.error}</p>
      )}

      {state?.outcome &&
        (() => {
          const copy = OUTCOME_COPY[state.outcome];
          const Icon = copy.icon;
          return (
            <div className={cn("flex items-start gap-3 rounded-lg border px-4 py-3", copy.className)}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-semibold">{copy.title}</p>
                <p className="mt-0.5 text-sm">{copy.body}</p>
              </div>
            </div>
          );
        })()}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Log visit"}
      </Button>
    </form>
  );
}
