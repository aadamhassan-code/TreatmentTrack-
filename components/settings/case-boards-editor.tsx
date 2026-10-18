"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { deleteBoard, saveBoard, setCasesAutoStart } from "@/lib/actions/cases";
import { MAX_EXPECTED_DAYS, MAX_STAGES, boardProblem, describeDuration, type BoardInput, type CaseBoard } from "@/lib/cases";

const input = "rounded-lg border border-ink-900/15 bg-cream-0 px-2.5 py-1.5 text-sm";

const toInput = (b: CaseBoard): BoardInput => ({
  id: b.id,
  name: b.name,
  keywords: b.keywords.join(", "),
  stages: b.stages.map((s) => ({ id: s.id, name: s.name, expectedDays: s.expected_days })),
});

export function CaseBoardsEditor({
  boards,
  autoStart,
  readOnly,
}: {
  boards: CaseBoard[];
  autoStart: boolean;
  readOnly: boolean;
}) {
  const [auto, setAuto] = useState(autoStart);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (readOnly) {
    return (
      <div className="space-y-3 text-sm text-ink-700">
        {boards.map((b) => (
          <p key={b.id}>
            <span className="font-medium text-ink-900">{b.name}:</span> {b.stages.map((s) => s.name).join(" → ")} → Completed
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Toggle
        checked={auto}
        onChange={(on) => {
          setAuto(on);
          setError(null);
          startTransition(async () => {
            const res = await setCasesAutoStart(on);
            if (res.error) {
              setError(res.error);
              setAuto(!on);
            }
          });
        }}
        label="Add booked quotes to the Cases board automatically"
        description="When a quote is marked Booked, the patient appears at the first stage of the matching board."
      />
      {error && <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{error}</p>}

      <div className="space-y-3">
        {boards.map((b) => (
          <BoardForm key={b.id} initial={toInput(b)} isDefault={b.is_default} />
        ))}
        {adding ? (
          <BoardForm
            initial={{ name: "", keywords: "", stages: [{ name: "Consultation", expectedDays: 14 }] }}
            isDefault={false}
            startOpen
            onDone={() => setAdding(false)}
          />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="text-sm font-medium text-teal-700 underline">
            + Add a board
          </button>
        )}
      </div>
      <p className="text-xs text-ink-500">
        A booked quote goes on the first board whose matching words appear in its treatment type (e.g.
        &ldquo;implant&rdquo; matches &ldquo;Implant UL6&rdquo;), otherwise on the catch-all board.
        &ldquo;Usually takes&rdquo; is how long a patient normally stays at that stage — longer and the card is
        flagged as overdue. Leave it blank for no warning.
      </p>
    </div>
  );
}

function BoardForm({
  initial,
  isDefault,
  startOpen = false,
  onDone,
}: {
  initial: BoardInput;
  isDefault: boolean;
  startOpen?: boolean;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(startOpen);
  const [board, setBoard] = useState<BoardInput>(initial);
  const [saved, setSaved] = useState<BoardInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const problem = boardProblem(board, isDefault);
  const dirty = JSON.stringify(board) !== JSON.stringify(saved);

  const setStage = (i: number, patch: Partial<BoardInput["stages"][number]>) =>
    setBoard((b) => ({ ...b, stages: b.stages.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const moveStage = (i: number, by: number) =>
    setBoard((b) => {
      const stages = [...b.stages];
      const [s] = stages.splice(i, 1);
      stages.splice(i + by, 0, s);
      return { ...b, stages };
    });

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveBoard(board);
      if (res.error) setError(res.error);
      else if (res.saved) {
        if (!board.id) return onDone?.();
        setBoard(res.saved);
        setSaved(res.saved);
      }
    });
  }

  if (!open) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-ink-900/8 bg-cream-0 p-4">
        <div className="min-w-0 text-sm">
          <p className="font-medium text-ink-900">
            {saved.name}
            {isDefault && <span className="ml-2 text-xs font-normal text-ink-500">(catch-all)</span>}
          </p>
          <p className="mt-0.5 text-ink-500">{saved.stages.map((s) => s.name).join(" → ")} → Completed</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-teal-700/30 bg-cream-0 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink-700">Board name</span>
          <input
            value={board.name}
            maxLength={60}
            onChange={(e) => setBoard({ ...board, name: e.target.value })}
            placeholder="e.g. Dentures"
            className={`${input} w-full`}
          />
        </label>
        {isDefault ? (
          <p className="self-end text-xs text-ink-500">Booked quotes that match no other board go here.</p>
        ) : (
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink-700">Matching words</span>
            <input
              value={board.keywords}
              onChange={(e) => setBoard({ ...board, keywords: e.target.value })}
              placeholder="e.g. denture, partial"
              className={`${input} w-full`}
            />
          </label>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink-700">Stages</p>
        <ol className="space-y-2">
          {board.stages.map((s, i) => (
            <li key={s.id ?? `new-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-5 text-right text-ink-500">{i + 1}.</span>
              <input
                value={s.name}
                maxLength={60}
                onChange={(e) => setStage(i, { name: e.target.value })}
                aria-label={`Stage ${i + 1} name`}
                className={`${input} min-w-0 flex-1`}
              />
              <span className="text-ink-500">usually</span>
              <input
                type="number"
                min={1}
                max={MAX_EXPECTED_DAYS}
                value={s.expectedDays ?? ""}
                onChange={(e) => setStage(i, { expectedDays: e.target.value === "" ? null : Math.round(Number(e.target.value)) })}
                aria-label={`Stage ${i + 1} usually takes (days)`}
                className={`${input} w-20 font-mono`}
              />
              <span className="w-24 text-ink-500">{s.expectedDays ? `days (${describeDuration(s.expectedDays)})` : "days"}</span>
              <span className="flex gap-1">
                <button type="button" disabled={i === 0} onClick={() => moveStage(i, -1)} aria-label="Move up" className="px-1 text-ink-500 disabled:opacity-30">
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === board.stages.length - 1}
                  onClick={() => moveStage(i, 1)}
                  aria-label="Move down"
                  className="px-1 text-ink-500 disabled:opacity-30"
                >
                  ↓
                </button>
                {board.stages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setBoard({ ...board, stages: board.stages.filter((_, j) => j !== i) })}
                    className="text-xs text-ink-500 underline hover:text-clay-700"
                  >
                    Remove
                  </button>
                )}
              </span>
            </li>
          ))}
          <li className="flex items-center gap-2 text-sm text-ink-500">
            <span className="w-5 text-right">✓</span> Completed <span className="text-xs">(always the last column)</span>
          </li>
        </ol>
        {board.stages.length < MAX_STAGES && (
          <button
            type="button"
            onClick={() => setBoard({ ...board, stages: [...board.stages, { name: "", expectedDays: null }] })}
            className="mt-2 text-sm font-medium text-teal-700 underline"
          >
            + Add a stage
          </button>
        )}
      </div>

      {(problem || error) && <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{error ?? problem}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={save} disabled={pending || !dirty || !!problem}>
          {pending ? "Saving…" : board.id ? "Save board" : "Create board"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setBoard(saved);
            setError(null);
            if (board.id) setOpen(false);
            else onDone?.();
          }}
        >
          {dirty ? "Cancel" : "Close"}
        </Button>
        {board.id && !isDefault && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Delete the ${saved.name} board?`)) return;
              setError(null);
              startTransition(async () => {
                const res = await deleteBoard(board.id!);
                if (res.error) setError(res.error);
              });
            }}
            className="ml-auto text-sm text-clay-700 underline"
          >
            Delete board
          </button>
        )}
      </div>
    </div>
  );
}
