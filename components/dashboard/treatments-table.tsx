"use client";

import { useTransition } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatGBP } from "@/lib/utils";
import { displayStatus } from "@/lib/treatment-status";
import { markTreatmentBooked, markTreatmentLost } from "@/lib/actions/treatments";
import type { Treatment } from "@/lib/types";

export function TreatmentsTable({ treatments }: { treatments: Treatment[] }) {
  const [isPending, startTransition] = useTransition();

  if (treatments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-900/15 px-6 py-16 text-center">
        <p className="font-display text-lg text-ink-700">No treatments logged yet</p>
        <p className="mt-1 text-sm text-ink-500">
          Add the first declined quote to start the automated follow-up sequence.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-ink-900/8 bg-cream-0">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-ink-900/8 text-xs uppercase tracking-wide text-ink-500">
            <th className="px-5 py-3 font-medium">Patient</th>
            <th className="px-5 py-3 font-medium">Treatment</th>
            <th className="px-5 py-3 font-medium">Value</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {treatments.map((t) => {
            const actionable = t.status === "in_sequence" || t.status === "future_intent";
            return (
              <tr key={t.id} className="border-b border-ink-900/6 last:border-0">
                <td className="px-5 py-4 text-ink-900">{t.patient?.full_name ?? "—"}</td>
                <td className="px-5 py-4 text-ink-700">{t.treatment_type}</td>
                <td className="px-5 py-4 font-mono tabular-nums text-ink-900">
                  {formatGBP(t.value_pence)}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={displayStatus(t)} />
                </td>
                <td className="px-5 py-4">
                  {actionable && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isPending}
                        onClick={() => startTransition(() => markTreatmentBooked(t.id))}
                      >
                        Mark booked
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => startTransition(() => markTreatmentLost(t.id))}
                      >
                        Mark lost
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
