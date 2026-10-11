"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateSequenceDays } from "@/lib/actions/settings";
import { MAX_DAYS, MAX_MESSAGES, SCHEDULE_PRESETS, describeDays, scheduleProblem } from "@/lib/schedule";
import { cn } from "@/lib/utils";

export function ScheduleEditor({ initialDays, readOnly = false }: { initialDays: number[]; readOnly?: boolean }) {
  const [days, setDays] = useState<number[]>(initialDays);
  const [saved, setSaved] = useState<number[]>(initialDays);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const problem = scheduleProblem(days);
  const dirty = days.join(",") !== saved.join(",");

  function setDay(i: number, value: string) {
    const n = Number(value);
    setDays((d) => d.map((x, j) => (j === i ? (Number.isFinite(n) ? Math.round(n) : x) : x)));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateSequenceDays(days);
      if (res.error) setError(res.error);
      else setSaved(days);
    });
  }

  if (readOnly) {
    return (
      <p className="text-sm text-ink-700">
        {days.length} message{days.length === 1 ? "" : "s"}: {days.map(describeDays).join(", ")} after the quote.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {SCHEDULE_PRESETS.map((p) => {
          const active = p.days.join(",") === days.join(",");
          return (
            <button
              key={p.name}
              type="button"
              onClick={() => setDays(p.days)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-sm",
                active ? "border-teal-700 bg-teal-50" : "border-ink-900/10 hover:border-ink-900/25"
              )}
            >
              <span className="block font-medium text-ink-900">{p.name}</span>
              <span className="block text-xs text-ink-500">{p.description}</span>
            </button>
          );
        })}
      </div>

      <ol className="space-y-2">
        {days.map((d, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 text-sm text-ink-700">
            <span className="w-24 font-medium text-ink-900">Message {i + 1}</span>
            <input
              type="number"
              min={1}
              max={MAX_DAYS}
              value={d}
              onChange={(e) => setDay(i, e.target.value)}
              aria-label={`Days after the quote for message ${i + 1}`}
              className="w-20 rounded-lg border border-ink-900/15 bg-cream-0 px-2.5 py-1.5 text-sm font-mono"
            />
            <span>days after the quote</span>
            <span className="text-ink-500">({describeDays(d)})</span>
            {days.length > 1 && (
              <button
                type="button"
                onClick={() => setDays(days.filter((_, j) => j !== i))}
                className="ml-1 text-xs text-ink-500 underline hover:text-clay-700"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ol>

      {days.length < MAX_MESSAGES && (
        <button
          type="button"
          onClick={() => setDays([...days, Math.min(MAX_DAYS, (days.at(-1) ?? 0) + 30)])}
          className="text-sm font-medium text-teal-700 underline"
        >
          + Add another message
        </button>
      )}

      {(problem || error) && (
        <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{problem ?? error}</p>
      )}

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={pending || !dirty || !!problem}>
          {pending ? "Saving…" : "Save schedule"}
        </Button>
        {!dirty && !pending && <span className="text-sm text-ink-500">Saved</span>}
      </div>
      <p className="text-xs text-ink-500">
        Changes apply to quotes added from now on. Quotes already being followed up keep the messages they were
        given. Every message includes an opt-out, and follow-up stops as soon as a patient books or replies STOP.
      </p>
    </div>
  );
}
