"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { ActionsMenu } from "@/components/ui/menu";
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

  // In-page confirmation for actions that restart messages (no browser pop-ups).
  const [confirming, setConfirming] = useState<{ id: string; kind: "resume" | "reopen" } | null>(null);

  function resume(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await resumeTreatment(id);
      if (res.error) setError(res.error);
      else setConfirming(null);
    });
  }

  function reopen(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await reopenTreatment(id);
        setConfirming(null);
      } catch {
        setError("Couldn't reopen that quote. Please try again.");
      }
    });
  }

  if (treatments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-900/15 px-6 py-16 text-center">
        <p className="font-medium text-ink-700">{mode === "open" ? "No open quotes" : "Nothing closed yet"}</p>
        <p className="mt-1 text-sm text-ink-500">
          {mode === "open"
            ? "Add a quote, or import a spreadsheet, and follow-up starts by itself."
            : "Quotes you mark Booked, Declined or Lost appear here."}
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
      <ul className="divide-y divide-ink-900/6 rounded-xl border border-ink-900/8 bg-cream-0 sm:hidden">
        {treatments.map((t) => (
          <li key={t.id} className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {t.patient ? (
                  <Link href={`/patients/${t.patient.id}`} className="block truncate font-medium text-ink-900">
                    {t.patient.full_name}
                  </Link>
                ) : (
                  <span className="font-medium text-ink-900">–</span>
                )}
                <span className="block truncate text-[13px] text-ink-500">{t.treatment_type}</span>
              </div>
              <span className="shrink-0 font-mono text-sm text-ink-900">{formatGBP(t.value_pence)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="flex flex-wrap items-center gap-2 text-[13px] text-ink-500">
                <StatusBadge status={displayStatus(t)} />
                {mode === "open" ? age(t.quoted_on) : (closedOn(t) ?? "")}
              </span>
              <span className="flex items-center gap-1">
                {mode === "open" ? (
                  <>
                    <Button size="sm" variant="secondary" disabled={isPending} onClick={() => close(t.id, "converted")}>
                      Booked
                    </Button>
                    <ActionsMenu
                      label={`More actions for ${t.patient?.full_name ?? "this quote"}`}
                      disabled={isPending}
                      items={[
                        { label: "Declined", onSelect: () => close(t.id, "declined") },
                        { label: "Lost (went quiet)", onSelect: () => close(t.id, "lost") },
                        t.status === "future_intent"
                          ? { label: "Resume follow-up now", onSelect: () => setConfirming({ id: t.id, kind: "resume" }) }
                          : { label: "Pause until…", onSelect: () => setPausingId(t.id) },
                      ]}
                    />
                  </>
                ) : (
                  <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setConfirming({ id: t.id, kind: "reopen" })}>
                    Reopen
                  </Button>
                )}
              </span>
            </div>
            {pausingId === t.id && (
              <div className="mt-3 rounded-lg bg-cream-50 p-3">
                <PausePanel
                  patientName={t.patient?.full_name ?? "this patient"}
                  busy={isPending}
                  onCancel={() => setPausingId(null)}
                  onPause={(date) => pause(t.id, date)}
                />
              </div>
            )}
            {confirming?.id === t.id && (
              <div className="mt-3 space-y-2 rounded-lg bg-cream-50 p-3 text-sm">
                <p className="text-ink-700">
                  {confirming.kind === "resume" ? "Restart follow-up now? The first message goes today." : "Reopen this quote and restart its remaining messages?"}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" disabled={isPending} onClick={() => (confirming.kind === "resume" ? resume(t.id) : reopen(t.id))}>
                    {confirming.kind === "resume" ? "Resume now" : "Reopen"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-ink-900/8 bg-cream-0 sm:block">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink-900/8 text-[13px] text-ink-500">
              <th className="px-5 py-3 font-medium">Patient and treatment</th>
              {dentistNames && <th className="px-4 py-3 font-medium">Dentist</th>}
              <th className="px-4 py-3 text-right font-medium">Value</th>
              <th className="px-4 py-3 font-medium">Quoted</th>
              <th className="px-4 py-3 font-medium">{mode === "open" ? "Status" : "Outcome"}</th>
              <th className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {treatments.map((t, i) => (
              <Fragment key={t.id}>
                <tr className="border-b border-ink-900/6 last:border-0 hover:bg-cream-50/60">
                  <td className="max-w-[18rem] px-5 py-3.5">
                    {t.patient ? (
                      <Link href={`/patients/${t.patient.id}`} className="block truncate font-medium text-ink-900 hover:text-teal-700 hover:underline">
                        {t.patient.full_name}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink-900">—</span>
                    )}
                    <span className="block truncate text-[13px] text-ink-500">{t.treatment_type}</span>
                  </td>
                  {dentistNames && (
                    <td className="whitespace-nowrap px-4 py-3.5 text-ink-700">
                      {t.dentist_user_id ? (dentistNames[t.dentist_user_id] ?? "Former team member") : <span className="text-ink-300">Not assigned</span>}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono tabular-nums text-ink-900">
                    {formatGBP(t.value_pence)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-ink-700">
                    {formatDate(t.quoted_on)}
                    {mode === "open" && <span className="block text-xs text-ink-500">{age(t.quoted_on)}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <StatusBadge status={displayStatus(t)} />
                    {mode === "open" && t.status === "future_intent" && t.future_intent_remind_at && (
                      <span className="mt-1 block text-xs text-ink-500">until {formatDate(t.future_intent_remind_at)}</span>
                    )}
                    {mode === "closed" && closedOn(t) && <span className="mt-1 block text-xs text-ink-500">{closedOn(t)}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1" data-tour={mode === "open" && i === 0 ? "outcome-buttons" : undefined}>
                      {mode === "open" ? (
                        <>
                          <Button size="sm" variant="secondary" disabled={isPending} onClick={() => close(t.id, "converted")}>
                            Booked
                          </Button>
                          <ActionsMenu
                            label={`More actions for ${t.patient?.full_name ?? "this quote"}`}
                            disabled={isPending}
                            items={[
                              { label: "Declined", onSelect: () => close(t.id, "declined") },
                              { label: "Lost (went quiet)", onSelect: () => close(t.id, "lost") },
                              t.status === "future_intent"
                                ? { label: "Resume follow-up now", onSelect: () => setConfirming({ id: t.id, kind: "resume" }) }
                                : { label: "Pause until…", onSelect: () => setPausingId(t.id) },
                            ]}
                          />
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setConfirming({ id: t.id, kind: "reopen" })}>
                          Reopen
                        </Button>
                      )}
                    </div>
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
                {confirming?.id === t.id && (
                  <tr className="border-b border-ink-900/6 bg-cream-50">
                    <td colSpan={99} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <p className="text-ink-700">
                          {confirming.kind === "resume"
                            ? "Restart follow-up now? The first message goes today."
                            : "Reopen this quote? It goes back on the open list and its remaining messages restart (the next one tomorrow at the earliest)."}
                        </p>
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => (confirming.kind === "resume" ? resume(t.id) : reopen(t.id))}
                        >
                          {confirming.kind === "resume" ? "Resume now" : "Reopen"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                          Cancel
                        </Button>
                      </div>
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
