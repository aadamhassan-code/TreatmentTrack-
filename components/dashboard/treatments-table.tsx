"use client";

import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { daysSince, formatDate, formatGBP } from "@/lib/utils";
import { displayStatus } from "@/lib/treatment-status";
import { reopenTreatment, setTreatmentOutcome } from "@/lib/actions/treatments";
import type { Treatment, TreatmentOutcome } from "@/lib/types";

const OUTCOME_BUTTONS: { outcome: TreatmentOutcome; label: string; variant: "secondary" | "ghost" }[] = [
  { outcome: "converted", label: "Booked", variant: "secondary" },
  { outcome: "declined", label: "Declined", variant: "ghost" },
  { outcome: "lost", label: "Lost", variant: "ghost" },
];

function closedOn(t: Treatment): string | null {
  const at = t.status === "converted" ? t.converted_at : t.status === "declined" ? t.declined_at : t.lost_at;
  return at ? formatDate(at) : null;
}

function age(quotedOn: string): string {
  const days = daysSince(quotedOn);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function TreatmentsTable({
  treatments,
  mode,
  dentistNames,
}: {
  treatments: Treatment[];
  mode: "open" | "closed";
  /** When given (owners/staff), a Dentist column is shown. */
  dentistNames?: Record<string, string>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function close(id: string, outcome: TreatmentOutcome) {
    setError(null);
    startTransition(async () => {
      try {
        await setTreatmentOutcome(id, outcome);
      } catch {
        setError("Couldn't update that quote. Please try again.");
      }
    });
  }

  function reopen(id: string) {
    if (!confirm("Reopen this quote? It goes back on the open list and its remaining follow-up messages restart (the next one tomorrow at the earliest).")) return;
    setError(null);
    startTransition(async () => {
      try {
        await reopenTreatment(id);
      } catch {
        setError("Couldn't reopen that quote. Please try again.");
      }
    });
  }

  if (treatments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-900/15 px-6 py-16 text-center">
        <p className="font-display text-lg text-ink-700">No open quotes</p>
        <p className="mt-1 text-sm text-ink-500">
          Add a declined quote, or import a list, to start the automated follow-up sequence.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-ink-900/8 bg-cream-0">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink-900/8 text-xs uppercase tracking-wide text-ink-500">
              {mode === "open" && <th className="w-10 py-3 pl-5 font-medium">#</th>}
              <th className="px-5 py-3 font-medium">Patient</th>
              <th className="px-5 py-3 font-medium">Treatment</th>
              {dentistNames && <th className="px-5 py-3 font-medium">Dentist</th>}
              <th className="px-5 py-3 text-right font-medium">Value</th>
              <th className="px-5 py-3 font-medium">Quoted</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">{mode === "open" ? "Mark as" : "Closed"}</th>
            </tr>
          </thead>
          <tbody>
            {treatments.map((t, i) => (
              <tr key={t.id} className="border-b border-ink-900/6 last:border-0">
                {mode === "open" && (
                  <td className="py-4 pl-5 font-mono text-xs tabular-nums text-ink-500">{i + 1}</td>
                )}
                <td className="px-5 py-4 text-ink-900">{t.patient?.full_name ?? "—"}</td>
                <td className="px-5 py-4 text-ink-700">{t.treatment_type}</td>
                {dentistNames && (
                  <td className="px-5 py-4 text-ink-700">
                    {t.dentist_user_id ? (dentistNames[t.dentist_user_id] ?? "Former team member") : "—"}
                  </td>
                )}
                <td className="px-5 py-4 text-right font-mono tabular-nums text-ink-900">
                  {formatGBP(t.value_pence)}
                </td>
                <td className="px-5 py-4 text-ink-700">
                  {formatDate(t.quoted_on)}
                  {mode === "open" && (
                    <span className="block text-xs text-ink-500">{age(t.quoted_on)}</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={displayStatus(t)} />
                </td>
                <td className="px-5 py-4">
                  {mode === "open" ? (
                    <div className="flex gap-1.5" data-tour={i === 0 ? "outcome-buttons" : undefined}>
                      {OUTCOME_BUTTONS.map(({ outcome, label, variant }) => (
                        <Button
                          key={outcome}
                          size="sm"
                          variant={variant}
                          disabled={isPending}
                          onClick={() => close(t.id, outcome)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-ink-700">{closedOn(t) ?? "—"}</span>
                      <Button size="sm" variant="ghost" disabled={isPending} onClick={() => reopen(t.id)}>
                        Reopen
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
