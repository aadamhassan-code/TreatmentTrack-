"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { saveTemplates, type TemplateEntry } from "@/lib/actions/settings";
import type { Channel, SequenceStep } from "@/lib/types";

const STEPS: { value: SequenceStep; label: string }[] = [
  { value: "day_3", label: "Day 3" },
  { value: "day_7", label: "Day 7" },
  { value: "day_14", label: "Day 14" },
  { value: "day_30", label: "Day 30" },
];

const CHANNELS: { value: Channel; label: string }[] = [
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
];

const VARIABLES = ["{patientName}", "{treatmentType}", "{practiceName}"];

export function TemplateEditor({
  templates,
  readOnly = false,
}: {
  templates: TemplateEntry[];
  readOnly?: boolean;
}) {
  const initial = new Map(
    templates.map((t) => [`${t.step}:${t.channel}`, t.body]),
  );
  const [bodies, setBodies] = useState<Map<string, string>>(initial);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function setBody(key: string, value: string) {
    setBodies((prev) => new Map(prev).set(key, value));
    setSaved(false);
  }

  function handleSave() {
    const entries: TemplateEntry[] = STEPS.flatMap(({ value: step }) =>
      CHANNELS.map(({ value: channel }) => ({
        step,
        channel,
        body: bodies.get(`${step}:${channel}`) ?? "",
      })),
    );
    startTransition(async () => {
      await saveTemplates(entries);
      setSaved(true);
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-500">
        Available variables:{" "}
        {VARIABLES.map((v) => (
          <code
            key={v}
            className="mx-1 rounded bg-ink-900/5 px-1.5 py-0.5 font-mono text-xs"
          >
            {v}
          </code>
        ))}
        — an opt-out is added automatically to any message that doesn&rsquo;t
        already include one. Empty a box and save to stop sending that message.
      </p>

      {STEPS.map(({ value: step, label }) => (
        <Card key={step}>
          <CardBody className="space-y-4">
            <p className="font-display text-lg font-medium text-teal-900">
              {label}
            </p>
            {CHANNELS.map(({ value: channel, label: channelLabel }) => {
              const key = `${step}:${channel}`;
              return (
                <div key={key}>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-ink-500">
                    {channelLabel}
                  </label>
                  <textarea
                    readOnly={readOnly}
                    value={bodies.get(key) ?? ""}
                    onChange={(e) => setBody(key, e.target.value)}
                    rows={2}
                    placeholder={`No ${channelLabel} template yet — add one to enable this channel for this step.`}
                    className="mt-1 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>
              );
            })}
          </CardBody>
        </Card>
      ))}

      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isPending} size="sm">
            {isPending ? "Saving…" : "Save templates"}
          </Button>
          {saved && !isPending && (
            <span className="text-sm text-teal-700">Saved.</span>
          )}
        </div>
      )}
    </div>
  );
}
