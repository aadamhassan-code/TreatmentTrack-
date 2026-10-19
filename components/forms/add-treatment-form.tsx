"use client";

import { useActionState, useState, useTransition } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { addTreatment, type AddTreatmentResult } from "@/lib/actions/treatments";

const TREATMENT_TYPES = [
  "Dental implant",
  "Crown",
  "Orthodontics",
  "Teeth whitening",
  "Veneers",
  "Bridge",
  "Root canal",
  "Other",
];

const FUTURE_INTENT_OPTIONS = [
  { value: "", label: "Start the sequence now" },
  { value: "1", label: "Not ready — remind in 1 month" },
  { value: "3", label: "Not ready — remind in 3 months" },
  { value: "6", label: "Not ready — remind in 6 months" },
  { value: "date", label: "Not ready — start on a date I choose (e.g. after Christmas)" },
];

export function AddTreatmentForm({
  dentists,
  lockedToSelf,
  defaultDentistId,
}: {
  dentists: { userId: string; name: string }[];
  /** Dentist logins always add quotes as themselves. */
  lockedToSelf: boolean;
  defaultDentistId: string;
}) {
  const [state, formAction, pending] = useActionState<AddTreatmentResult, FormData>(
    async (_prev, formData) => addTreatment(formData),
    {}
  );

  const [quoteFollowupOffered, setQuoteFollowupOffered] = useState(false);
  const [crossSellConsent, setCrossSellConsent] = useState(false);
  const [futureIntent, setFutureIntent] = useState("");
  const [reconsent, setReconsent] = useState(false);
  const [, startTransition] = useTransition();

  // Submitting via onSubmit (not the form's `action` prop) stops React
  // clearing everything staff typed when the server sends back an error.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink-900">
          Add a quote
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          Log a treatment plan the patient hasn&rsquo;t accepted yet so
          TreatmentTrack can start following up.
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
                placeholder="Fatima Ahmed"
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
                placeholder="07700 900123"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-900" htmlFor="email">
              Email <span className="font-normal text-ink-500">(optional — needed for email follow-ups)</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
              placeholder="fatima@example.com"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-ink-900" htmlFor="treatmentType">
                Treatment type
              </label>
              <select
                id="treatmentType"
                name="treatmentType"
                required
                defaultValue=""
                className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
              >
                <option value="" disabled>
                  Select a treatment
                </option>
                {TREATMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            {!lockedToSelf && dentists.length > 0 && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-ink-900" htmlFor="dentistUserId">
                  Treating dentist <span className="font-normal text-ink-500">(optional)</span>
                </label>
                <select
                  id="dentistUserId"
                  name="dentistUserId"
                  defaultValue={defaultDentistId}
                  className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                >
                  <option value="">Not assigned</option>
                  {dentists.map((d) => (
                    <option key={d.userId} value={d.userId}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-ink-900" htmlFor="value">
                Quoted value (£)
              </label>
              <input
                id="value"
                name="value"
                type="number"
                min="1"
                step="1"
                required
                className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm font-mono focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                placeholder="2400"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <p className="text-sm font-semibold text-ink-900">Consent</p>

          <Toggle
            checked={quoteFollowupOffered}
            onChange={setQuoteFollowupOffered}
            required
            label="Opt-out was offered for follow-up on this exact quote"
            description="Required. This is the PECR soft opt-in — without it, the automated sequence cannot be created."
          />
          <input
            type="hidden"
            name="quoteFollowupOffered"
            value={quoteFollowupOffered ? "on" : ""}
          />

          <Toggle
            checked={crossSellConsent}
            onChange={setCrossSellConsent}
            label="Patient has separately consented to be contacted about other treatments based on dental history"
            description="Optional, and never assumed from the toggle above. Only needed if you want this patient eligible for cross-sell suggestions from Log Visit."
          />
          <input
            type="hidden"
            name="crossSellConsent"
            value={crossSellConsent ? "on" : ""}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <p className="text-sm font-semibold text-ink-900">Timing</p>
          <div className="space-y-2">
            {FUTURE_INTENT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm",
                  futureIntent === opt.value
                    ? "border-teal-700 bg-teal-50"
                    : "border-ink-900/10"
                )}
              >
                <input
                  type="radio"
                  name="futureIntentMonths"
                  value={opt.value}
                  checked={futureIntent === opt.value}
                  onChange={() => setFutureIntent(opt.value)}
                  className="h-4 w-4 accent-teal-700"
                />
                {opt.label}
              </label>
            ))}
            {futureIntent === "date" && (
              <div className="pl-7">
                <label className="block text-sm font-medium text-ink-900" htmlFor="futureIntentDate">
                  Start follow-up on
                </label>
                <input
                  id="futureIntentDate"
                  name="futureIntentDate"
                  type="date"
                  required
                  className="mt-1.5 rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-ink-500">
                  Nothing is sent before then. On that day the first message goes, and the rest follow your schedule.
                </p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {state?.error && (
        <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">
          {state.error}
        </p>
      )}

      {state?.needsReconsent && (
        <Card>
          <CardBody>
            <Toggle
              checked={reconsent}
              onChange={setReconsent}
              label="The patient has asked us to contact them again about this quote"
              description="This is recorded in their consent history with your name and today's date. If they haven't asked, don't add this quote."
            />
          </CardBody>
        </Card>
      )}
      <input type="hidden" name="reconsent" value={reconsent ? "on" : ""} />

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Add quote and start follow-up"}
      </Button>
    </form>
  );
}
