"use client";

import { Fragment, useState, useTransition } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { daysSince, formatDate, formatGBP, ukDate } from "@/lib/utils";
import { displayStatus } from "@/lib/treatment-status";
import {
  pauseTreatment,
  reopenTreatment,
  resumeTreatment,
  setTreatmentOutcome,
} from "@/lib/actions/treatments";
import type { Treatment, TreatmentOutcome } from "@/lib/types";

const OUTCOME_BUTTONS: {
  outcome: TreatmentOutcome;
  label: string;
  variant: "secondary" | "ghost";
}[] = [
  { outcome: "converted", label: "Booked", variant: "secondary" },
  { outcome: "declined", label: "Declined", variant: "ghost" },
  { outcome: "lost", label: "Lost", variant: "ghost" },
];

function closedOn(t: Treatment): string | null {
  const at =
    t.status === "converted"
      ? t.converted_at
      : t.status === "declined"
        ? t.declined_at
        : t.lost_at;
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

  const [pausingId, setPausingId] = useState<string | null>(null);

  function pause(id: string, date: string) {
    setError(null);
    startTransition(async () => {
      const res = await pauseTreatment(id, date);
      if (res.error) setError(res.error);
      else setPausingId(null);
    });
  }

  function resume(id: string) {
    if (!confirm("Restart follow-up now? The first message goes today."))
      return;
    setError(null);
    startTransition(async () => {
      const res = await resumeTreatment(id);
      if (res.error) setError(res.error);
    });
  }

  function reopen(id: string) {
    if (
      !confirm(
        "Reopen this quote? It goes back on the open list and its remaining follow-up messages restart (the next one tomorrow at the earliest).",
      )
    )
      return;
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
          Add a declined quote, or import a list, to start the automated
          follow-up sequence.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-ink-900/8 bg-cream-0">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink-900/8 text-xs uppercase tracking-wide text-ink-500">
              {mode === "open" && (
                <th className="w-10 py-3 pl-5 font-medium">#</th>
              )}
              <th className="px-5 py-3 font-medium">Patient</th>
              <th className="px-5 py-3 font-medium">Treatment</th>
              {dentistNames && (
                <th className="px-5 py-3 font-medium">Dentist</th>
              )}
              <th className="px-5 py-3 text-right font-medium">Value</th>
              <th className="px-5 py-3 font-medium">Quoted</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">
                {mode === "open" ? "Mark as" : "Closed"}
              </th>
            </tr>
          </thead>
          <tbody>
            {treatments.map((t, i) => (
              <Fragment key={t.id}>
                <tr className="border-b border-ink-900/6 last:border-0">
                  {mode === "open" && (
                    <td className="py-4 pl-5 font-mono text-xs tabular-nums text-ink-500">
                      {i + 1}
                    </td>
                  )}
                  <td className="px-5 py-4 text-ink-900">
                    {t.patient?.full_name ?? "—"}
                  </td>
                  <td className="px-5 py-4 text-ink-700">{t.treatment_type}</td>
                  {dentistNames && (
                    <td className="px-5 py-4 text-ink-700">
                      {t.dentist_user_id
                        ? (dentistNames[t.dentist_user_id] ??
                          "Former team member")
                        : "—"}
                    </td>
                  )}
                  <td className="px-5 py-4 text-right font-mono tabular-nums text-ink-900">
                    {formatGBP(t.value_pence)}
                  </td>
                  <td className="px-5 py-4 text-ink-700">
                    {formatDate(t.quoted_on)}
                    {mode === "open" && (
                      <span className="block text-xs text-ink-500">
                        {age(t.quoted_on)}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={displayStatus(t)} />
                    {t.status === "future_intent" &&
                      t.future_intent_remind_at && (
                        <span className="mt-1 block text-xs text-ink-500">
                          until {formatDate(t.future_intent_remind_at)}
                        </span>
                      )}
                  </td>
                  <td className="px-5 py-4">
                    {mode === "open" ? (
                      <div className="flex flex-wrap gap-1.5">
                        <div
                          className="flex gap-1.5"
                          data-tour={i === 0 ? "outcome-buttons" : undefined}
                        >
                          {OUTCOME_BUTTONS.map(
                            ({ outcome, label, variant }) => (
                              <Button
                                key={outcome}
                                size="sm"
                                variant={variant}
                                disabled={isPending}
                                onClick={() => close(t.id, outcome)}
                              >
                                {label}
                              </Button>
                            ),
                          )}
                        </div>
                        {t.status === "future_intent" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isPending}
                            onClick={() => resume(t.id)}
                          >
                            Resume now
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isPending}
                            onClick={() =>
                              setPausingId(pausingId === t.id ? null : t.id)
                            }
                          >
                            Pause…
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-ink-700">
                          {closedOn(t) ?? "—"}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => reopen(t.id)}
                        >
                          Reopen
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
                {pausingId === t.id && (
                  <tr className="border-b border-ink-900/6 bg-cream-50">
                    <td colSpan={99} className="px-5 py-4">
                      <PausePanel
                        patientName={t.patient?.full_name ?? "this patient"}
                        busy={isPending}
                        onCancel={() => setPausingId(null)}
                        onPause={(date) => pause(t.id, date)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Quick picks plus any date. "After Christmas" is offered from September. */
function PausePanel({
  patientName,
  busy,
  onCancel,
  onPause,
}: {
  patientName: string;
  busy: boolean;
  onCancel: () => void;
  onPause: (date: string) => void;
}) {
  const today = ukDate();
  const [y, m] = today.split("-").map(Number);
  const picks: { label: string; date: string }[] = [
    { label: "2 weeks", date: addDays(today, 14) },
    { label: "1 month", date: addDays(today, 30) },
    { label: "3 months", date: addDays(today, 91) },
  ];
  if (m >= 9)
    picks.unshift({ label: "After Christmas", date: `${y + 1}-01-02` });
  const [date, setDate] = useState(picks[0].date);

  return (
    <div className="space-y-3 text-sm">
      <p className="text-ink-700">
        Pause follow-up for <strong>{patientName}</strong>. No messages until
        then; on that day the first message goes and the rest follow your
        schedule.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {picks.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setDate(p.date)}
            className={`rounded-lg border px-3 py-1.5 ${date === p.date ? "border-teal-700 bg-teal-50" : "border-ink-900/10"}`}
          >
            {p.label}{" "}
            <span className="text-ink-500">({formatDate(p.date)})</span>
          </button>
        ))}
        <input
          type="date"
          value={date}
          min={addDays(today, 1)}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Pause until"
          className="rounded-lg border border-ink-900/15 bg-cream-0 px-2.5 py-1.5"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={busy || !date}
          onClick={() => onPause(date)}
        >
          Pause until {date ? formatDate(date) : "…"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
