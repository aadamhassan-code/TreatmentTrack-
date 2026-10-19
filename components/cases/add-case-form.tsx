"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addCase } from "@/lib/actions/cases";

const field = "w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3 py-2 text-sm";

/**
 * For patients who said yes straight away (so there was never a quote to
 * follow up), or anyone already part-way through treatment.
 */
export function AddCaseForm({
  boards,
  defaultBoardId,
  dentists,
}: {
  boards: { id: string; name: string; stages: { id: string; name: string }[] }[];
  defaultBoardId: string;
  /** null for Dentist logins (cases are always theirs). */
  dentists: { userId: string; name: string }[] | null;
}) {
  const [open, setOpen] = useState(false);
  const [boardId, setBoardId] = useState(defaultBoardId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const board = boards.find((b) => b.id === boardId) ?? boards[0];

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setBoardId(defaultBoardId);
            setOpen(true);
          }}
        >
          + Add a patient
        </Button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const res = await addCase(formData);
          if (res.error) setError(res.error);
          else {
            formRef.current?.reset();
            setOpen(false);
          }
        });
      }}
      className="space-y-4 rounded-xl border border-ink-900/8 bg-cream-0 p-5"
    >
      <div>
        <h2 className="font-display text-lg text-ink-900">Add a patient to the board</h2>
        <p className="mt-1 text-sm text-ink-500">
          For patients who booked straight away or are already part-way through treatment. Booked quotes are added
          for you.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink-700">Patient name</span>
          <input name="patientName" required maxLength={120} className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink-700">Treatment</span>
          <input name="treatmentType" required maxLength={120} placeholder="e.g. Implant UL6" className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink-700">Value (£, optional)</span>
          <input name="value" type="number" min={0} step="0.01" inputMode="decimal" className={field} />
        </label>
        {dentists && dentists.length > 0 && (
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink-700">Dentist</span>
            <select name="dentistUserId" defaultValue="" className={field}>
              <option value="">Not assigned</option>
              {dentists.map((d) => (
                <option key={d.userId} value={d.userId}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink-700">Board</span>
          <select name="boardId" value={boardId} onChange={(e) => setBoardId(e.target.value)} className={field}>
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink-700">Where are they now?</span>
          <select name="stageId" key={board.id} defaultValue={board.stages[0]?.id} className={field}>
            {board.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-ink-500">
        Only what&rsquo;s needed to track the case. No messages are sent to the patient from this board.
      </p>
      {error && <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add to board"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
