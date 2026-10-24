"use client";

import { useActionState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import {
  requestCallback,
  type RequestCallbackResult,
} from "@/lib/actions/callback-requests";

export type CallbackTopic = "sales" | "walkthrough" | "founding";

const SUCCESS: Record<CallbackTopic, string> = {
  founding: "Thanks — we'll call you within one working day to show you TreatmentTrack and talk through getting started.",
  walkthrough: "Thanks — we'll be in touch within one working day to arrange your walkthrough.",
  sales: "We'll be in touch within one working day to talk through pricing for your group.",
};

const PRACTICE_SOFTWARE = ["Dentally", "Software of Excellence (Exact)", "R4", "CareStack", "Other"];

export function RequestCallbackForm({
  topic = "sales",
  plan,
}: { topic?: CallbackTopic; plan?: string } = {}) {
  const founding = topic === "founding";
  const [state, formAction, pending] = useActionState<RequestCallbackResult, FormData>(
    async (_prev, formData) => requestCallback(formData),
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

  if (state?.success) {
    return (
      <Card>
        <CardBody className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
          <div>
            <p className="font-medium text-ink-900">Request received</p>
            <p className="mt-1 text-sm text-ink-500">{SUCCESS[topic]}</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot for bots — hidden from people and screen readers. */}
      <input type="hidden" name="topic" value={topic} />
      {plan && <input type="hidden" name="plan" value={plan} />}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <Card>
        <CardBody className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-ink-900" htmlFor="name">
                Your name
              </label>
              <input
                id="name"
                name="name"
                required
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
                name="email"
                type="email"
                required
                className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                placeholder={founding ? "priya@riversidedental.co.uk" : "priya@group.co.uk"}
              />
            </div>
          </div>
          {founding && (
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-ink-900" htmlFor="practiceName">
                  Practice name
                </label>
                <input
                  id="practiceName"
                  name="practiceName"
                  required
                  maxLength={200}
                  className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  placeholder="Riverside Dental"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-900" htmlFor="software">
                  Practice software
                </label>
                <select
                  id="software"
                  name="software"
                  defaultValue=""
                  className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                >
                  <option value="">Choose…</option>
                  {PRACTICE_SOFTWARE.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-ink-900" htmlFor="phone">
                Phone number
              </label>
              <input
                id="phone"
                name="phone"
                className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                placeholder="07700 900123"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-900" htmlFor="practiceCount">
                How many practices?
              </label>
              <input
                id="practiceCount"
                name="practiceCount"
                type="number"
                min={1}
                className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm font-mono focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                placeholder="1"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-900" htmlFor="message">
              Anything else we should know? (optional)
            </label>
            <textarea
              id="message"
              name="message"
              rows={3}
              className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
              placeholder={
                founding
                  ? "e.g. roughly how many private treatment quotes you give a month, or the best time to call"
                  : "Rollout timeline, existing PMS, number of sites live vs planned…"
              }
            />
          </div>
        </CardBody>
      </Card>

      {state?.error && (
        <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{state.error}</p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Sending…" : founding ? "Request a call" : "Request a callback"}
      </Button>
    </form>
  );
}
