"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { formatDate, formatGBP } from "@/lib/utils";
import {
  dismissDentallyQuotes,
  startDentallyQuotes,
  syncDentallyNow,
  type IntegrationActionResult,
} from "@/lib/actions/integrations";

export interface Candidate {
  id: string;
  patient_name: string;
  phone: string | null;
  treatment_type: string;
  value_pence: number;
  quoted_on: string;
  blocked_reason: string | null;
}

export function DentallyReview({
  candidates,
  lastSyncedAt,
  lastSyncError,
}: {
  candidates: Candidate[];
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<IntegrationActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const selectable = candidates.filter((c) => !c.blocked_reason);
  const chosen = candidates.filter((c) => selected.has(c.id));
  const chosenValue = chosen.reduce((sum, c) => sum + c.value_pence, 0);
  const allSelected = selectable.length > 0 && selectable.every((c) => selected.has(c.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(action: () => Promise<IntegrationActionResult>) {
    setResult(null);
    startTransition(async () => {
      const res = await action();
      setResult(res);
      if (!res.error) {
        setSelected(new Set());
        setConfirmed(false);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-500">
        <span>
          {lastSyncedAt
            ? `Last synced ${formatDate(lastSyncedAt)}`
            : "Not synced yet"}
          {lastSyncError && <span className="ml-2 text-clay-700">· {lastSyncError}</span>}
        </span>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(syncDentallyNow)}>
          {pending ? "Working…" : "Sync now"}
        </Button>
      </div>

      {result?.error && <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{result.error}</p>}
      {result?.message && <p className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-800">{result.message}</p>}

      {candidates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-900/15 px-6 py-10 text-center text-sm text-ink-500">
          Nothing waiting for review. New unbooked private treatment plans will appear here after the next sync.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-ink-900/8 bg-cream-0">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-ink-900/8 text-xs uppercase tracking-wide text-ink-500">
                  <th className="w-10 py-3 pl-5">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((c) => c.id)))}
                      className="h-4 w-4 accent-teal-700"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Treatment plan</th>
                  <th className="px-4 py-3 text-right font-medium">Value</th>
                  <th className="px-4 py-3 font-medium">Planned</th>
                  <th className="px-4 py-3 font-medium">Check</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="border-b border-ink-900/6 align-top last:border-0">
                    <td className="py-3 pl-5">
                      <input
                        type="checkbox"
                        aria-label={`Select ${c.patient_name}`}
                        disabled={!!c.blocked_reason}
                        checked={selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                        className="h-4 w-4 accent-teal-700"
                      />
                    </td>
                    <td className="px-4 py-3 text-ink-900">
                      {c.patient_name}
                      {c.phone && <span className="block font-mono text-xs text-ink-500">{c.phone}</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-700">{c.treatment_type}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatGBP(c.value_pence)}</td>
                    <td className="px-4 py-3 text-ink-700">{formatDate(c.quoted_on)}</td>
                    <td className="px-4 py-3">
                      {c.blocked_reason ? (
                        <span className="flex items-start gap-1 text-clay-700">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          {c.blocked_reason}
                        </span>
                      ) : (
                        <span className="text-teal-700">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Card>
            <CardBody className="space-y-4">
              <p className="text-sm text-ink-700">
                <strong>{chosen.length}</strong> selected ({formatGBP(chosenValue)})
              </p>
              <Toggle
                checked={confirmed}
                onChange={setConfirmed}
                required
                label="Each selected patient was offered an opt-out for follow-up on this treatment plan"
                description="Required — the same PECR soft opt-in as Add Treatment. It's recorded against each quote with your name and today's date. Leave out anyone who wasn't offered an opt-out."
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={pending || chosen.length === 0 || !confirmed}
                  onClick={() => run(() => startDentallyQuotes(chosen.map((c) => c.id), confirmed))}
                >
                  {pending ? "Working…" : `Start follow-up for ${chosen.length}`}
                </Button>
                <Button
                  variant="ghost"
                  disabled={pending || chosen.length === 0}
                  onClick={() => {
                    if (confirm(`Dismiss ${chosen.length} treatment plan(s)? They won't be followed up or shown again.`)) {
                      run(() => dismissDentallyQuotes(chosen.map((c) => c.id)));
                    }
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
