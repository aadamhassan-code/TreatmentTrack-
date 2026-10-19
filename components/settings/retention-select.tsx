"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateRetentionMonths } from "@/lib/actions/settings";
import { RETENTION_CHOICES, retentionLabel } from "@/lib/retention";

export function RetentionSelect({ initial, readOnly }: { initial: number; readOnly: boolean }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [result, setResult] = useState<{ error?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const choices = (RETENTION_CHOICES as readonly number[]).includes(initial)
    ? RETENTION_CHOICES
    : [...RETENTION_CHOICES, initial].sort((a, b) => a - b);

  return (
    <form
      className="flex flex-wrap items-center gap-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        setResult(null);
        startTransition(async () => {
          const res = await updateRetentionMonths(value);
          setResult(res);
          if (!res.error) setSaved(value);
        });
      }}
    >
      <label htmlFor="retention" className="text-ink-900">
        Erase inactive patients after
      </label>
      <select
        id="retention"
        value={value}
        disabled={readOnly}
        onChange={(e) => setValue(Number(e.target.value))}
        className="rounded-lg border border-ink-900/15 bg-cream-0 px-3 py-2"
      >
        {choices.map((m) => (
          <option key={m} value={m}>
            {retentionLabel(m)}
          </option>
        ))}
      </select>
      {!readOnly && value !== saved && (
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      )}
      {result?.error && <span className="text-clay-700">{result.error}</span>}
      {result && !result.error && value === saved && <span className="text-teal-700">Saved.</span>}
    </form>
  );
}
