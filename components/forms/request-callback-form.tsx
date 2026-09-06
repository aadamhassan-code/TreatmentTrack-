"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import {
  requestCallback,
  type RequestCallbackResult,
} from "@/lib/actions/callback-requests";

export function RequestCallbackForm() {
  const [state, formAction, pending] = useActionState<RequestCallbackResult, FormData>(
    async (_prev, formData) => requestCallback(formData),
    {}
  );

  if (state?.success) {
    return (
      <Card>
        <CardBody className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
          <div>
            <p className="font-medium text-ink-900">Request received</p>
            <p className="mt-1 text-sm text-ink-500">
              We&rsquo;ll be in touch within one working day to talk through
              pricing for your group.
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
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
                placeholder="priya@group.co.uk"
              />
            </div>
          </div>
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
                min={6}
                className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm font-mono focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                placeholder="8"
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
              placeholder="Rollout timeline, existing PMS, number of sites live vs planned…"
            />
          </div>
        </CardBody>
      </Card>

      {state?.error && (
        <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{state.error}</p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Request a callback"}
      </Button>
    </form>
  );
}
