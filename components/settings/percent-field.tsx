"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

/** A small "% of fees" input with its own Save, used for dentist shares and lab costs. */
export function PercentField({
  label,
  initial,
  onSave,
  hint,
}: {
  label: string;
  initial: number | null;
  onSave: (value: string) => Promise<{ error?: string; message?: string }>;
  hint?: string;
}) {
  const start = initial == null ? "" : String(initial);
  const [value, setValue] = useState(start);
  const [saved, setSaved] = useState(start);
  const [result, setResult] = useState<{ error?: string; message?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap items-center gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        setResult(null);
        startTransition(async () => {
          const res = await onSave(value);
          setResult(res);
          if (!res.error) setSaved(value);
        });
      }}
    >
      <label className="text-ink-700">
        <span className="sr-only">{label}</span>
        <span className="relative inline-block">
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="–"
            aria-label={label}
            className="w-20 rounded-lg border border-ink-900/15 bg-cream-0 py-1.5 pl-2.5 pr-7 text-right font-mono focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
          <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-500">
            %
          </span>
        </span>
      </label>
      {value !== saved && (
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      )}
      {hint && <span className="text-[13px] text-ink-500">{hint}</span>}
      {result?.error && <span className="text-[13px] text-clay-700">{result.error}</span>}
      {result?.message && value === saved && <span className="text-[13px] text-teal-700">{result.message}</span>}
    </form>
  );
}
