"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { moveCase, moveCaseToBoard, saveCaseNote, stopCase } from "@/lib/actions/cases";
import { cn, formatDate, formatGBP } from "@/lib/utils";
import { daysAtStage, describeDuration, isStuck, type CaseBoard, type CaseEvent, type CaseRow } from "@/lib/cases";

const COMPLETED = "completed";

/** Pastel label colours for stage columns, in board order. */
const STAGE_TAGS = ["bg-lilac", "bg-sky", "bg-butter", "bg-rose", "bg-teal-100"];

type Move = { id: string; to: string };

/** Which column a case is in: a stage id, or "completed". */
const columnOf = (c: CaseRow) => (c.status === "completed" ? COMPLETED : c.stage_id);

/**
 * Trello-style board: one column per stage plus Completed. Drag a card to
 * another column (on a computer), or use its arrow buttons (anywhere,
 * including phones).
 */
export function CaseBoardView({
  board,
  boards,
  cases,
  events,
  dentistNames,
  completedShownDays,
}: {
  board: CaseBoard;
  boards: { id: string; name: string }[];
  cases: CaseRow[];
  events: CaseEvent[];
  /** When given (owners/staff), each card shows the dentist. */
  dentistNames?: Record<string, string>;
  completedShownDays: number;
}) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [shown, applyMove] = useOptimistic(cases, (state: CaseRow[], move: Move) =>
    state.map((c) =>
      c.id !== move.id
        ? c
        : move.to === COMPLETED
          ? { ...c, status: "completed" as const, completed_at: new Date().toISOString() }
          : { ...c, status: "active" as const, stage_id: move.to, stage_entered_at: new Date().toISOString() }
    )
  );

  const columns = [
    ...board.stages.map((s) => ({ id: s.id, name: s.name, stage: s })),
    { id: COMPLETED, name: "Completed", stage: undefined },
  ];

  function move(c: CaseRow, to: string) {
    if (columnOf(c) === to) return;
    setError(null);
    startTransition(async () => {
      applyMove({ id: c.id, to });
      const res = await moveCase(c.id, to);
      if (res.error) setError(res.error);
    });
  }

  // Cases whose stage was removed from the board show in the first column.
  const known = new Set(columns.map((col) => col.id));
  const inColumn = (colId: string) =>
    shown.filter((c) => {
      const at = columnOf(c);
      return at === colId || (colId === columns[0].id && (!at || !known.has(at)));
    });

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{error}</p>}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8">
        <div className="flex gap-4" style={{ minWidth: columns.length * 272 }}>
          {columns.map((col, i) => {
            const list = inColumn(col.id);
            return (
              <section
                key={col.id}
                aria-label={col.name}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(col.id);
                }}
                onDragLeave={() => setDragOver((d) => (d === col.id ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const c = shown.find((x) => x.id === e.dataTransfer.getData("text/plain"));
                  if (c) move(c, col.id);
                }}
                className={cn(
                  "flex w-64 shrink-0 flex-col rounded-xl border bg-teal-50 p-2.5 transition-colors",
                  dragOver === col.id ? "border-teal-600 bg-sky/30" : "border-transparent"
                )}
              >
                <header className="mb-3 flex items-baseline justify-between gap-2 px-1">
                  <h3 className={cn("rounded px-1.5 py-px text-[13px] font-medium text-ink-900", col.id === COMPLETED ? "bg-sage" : STAGE_TAGS[i % STAGE_TAGS.length])}>{col.name}</h3>
                  <span className="text-xs text-ink-500">{list.length}</span>
                </header>
                {col.stage?.expected_days && (
                  <p className="-mt-2 mb-2 px-1 text-[11px] text-ink-500">Usually {describeDuration(col.stage.expected_days)}</p>
                )}
                {col.id === COMPLETED && (
                  <p className="-mt-2 mb-2 px-1 text-[11px] text-ink-500">Last {completedShownDays} days</p>
                )}
                <div className="flex flex-1 flex-col gap-2">
                  {list.map((c) => (
                    <CaseCard
                      key={c.id}
                      c={c}
                      stage={col.stage}
                      prev={i > 0 ? columns[i - 1] : undefined}
                      next={columns[i + 1]}
                      onMove={(to) => move(c, to)}
                      columns={columns}
                      boards={boards}
                      boardId={board.id}
                      events={events.filter((e) => e.case_id === c.id)}
                      dentistName={dentistNames ? (c.dentist_user_id ? (dentistNames[c.dentist_user_id] ?? "Former dentist") : "No dentist") : undefined}
                      onError={setError}
                    />
                  ))}
                  {list.length === 0 && <p className="px-1 py-4 text-center text-xs text-ink-500/70">Drop a patient here</p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CaseCard({
  c,
  stage,
  prev,
  next,
  onMove,
  columns,
  boards,
  boardId,
  events,
  dentistName,
  onError,
}: {
  c: CaseRow;
  stage: CaseBoard["stages"][number] | undefined;
  prev?: { id: string; name: string };
  next?: { id: string; name: string };
  onMove: (to: string) => void;
  columns: { id: string; name: string }[];
  boards: { id: string; name: string }[];
  boardId: string;
  events: CaseEvent[];
  dentistName?: string;
  onError: (e: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(c.note ?? "");
  const [pending, startTransition] = useTransition();
  const done = c.status === "completed";
  const days = daysAtStage(c.stage_entered_at);
  const late = isStuck(c, stage);

  function run(action: () => Promise<{ error?: string }>) {
    onError(null);
    startTransition(async () => {
      const res = await action();
      if (res.error) onError(res.error);
    });
  }

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", c.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "cursor-grab rounded-lg border bg-cream-0 p-3 text-sm shadow-sm active:cursor-grabbing",
        late ? "border-clay-500" : "border-ink-900/10"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-ink-900">{c.patient_name}</p>
        {c.value_pence > 0 && <p className="shrink-0 font-mono text-xs text-ink-700">{formatGBP(c.value_pence)}</p>}
      </div>
      <p className="text-xs text-ink-500">
        {c.treatment_type}
        {dentistName && <> · {dentistName}</>}
      </p>
      <p className={cn("mt-1.5 text-xs", late ? "font-medium text-clay-700" : "text-ink-500")}>
        {done
          ? `Completed ${c.completed_at ? formatDate(c.completed_at) : ""}`
          : late
            ? `Overdue: ${describeDuration(days)} here (usually ${describeDuration(stage!.expected_days!)})`
            : days === 0
              ? "Arrived today"
              : `${describeDuration(days)} at this stage`}
      </p>
      {c.note && !open && <p className="mt-1.5 line-clamp-2 rounded bg-gold-100/60 px-2 py-1 text-xs text-ink-700">{c.note}</p>}

      <div className="mt-2 flex items-center gap-1">
        {prev && (
          <button
            type="button"
            onClick={() => onMove(prev.id)}
            aria-label={`Move back to ${prev.name}`}
            title={`Back to ${prev.name}`}
            className="rounded-md px-2 py-1 text-xs text-ink-500 hover:bg-ink-900/5 hover:text-ink-900"
          >
            ←
          </button>
        )}
        {next && (
          <button
            type="button"
            onClick={() => onMove(next.id)}
            className="rounded-md bg-teal-900/5 px-2 py-1 text-xs font-medium text-teal-900 hover:bg-teal-900/10"
          >
            {next.id === COMPLETED ? "Mark completed ✓" : `${next.name} →`}
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="ml-auto rounded-md px-2 py-1 text-xs text-ink-500 hover:bg-ink-900/5 hover:text-ink-900"
        >
          {open ? "Close" : "More"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-ink-900/8 pt-3 text-xs" onDragStart={(e) => e.preventDefault()}>
          <label className="block">
            <span className="mb-1 block font-medium text-ink-700">Stage</span>
            <select
              value={done ? COMPLETED : (c.stage_id ?? "")}
              onChange={(e) => onMove(e.target.value)}
              className="w-full rounded-md border border-ink-900/15 bg-cream-0 px-2 py-1.5"
            >
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </label>
          {boards.length > 1 && (
            <label className="block">
              <span className="mb-1 block font-medium text-ink-700">Board</span>
              <select
                value={boardId}
                disabled={pending}
                onChange={(e) => {
                  const to = e.target.value;
                  const name = boards.find((b) => b.id === to)?.name;
                  if (confirm(`Move ${c.patient_name} to the ${name} board? They'll start at its first stage.`)) {
                    run(() => moveCaseToBoard(c.id, to));
                  }
                }}
                className="w-full rounded-md border border-ink-900/15 bg-cream-0 px-2 py-1.5"
              >
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="mb-1 block font-medium text-ink-700">Admin note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              rows={2}
              placeholder="e.g. Lab due back Tuesday"
              className="w-full rounded-md border border-ink-900/15 bg-cream-0 px-2 py-1.5"
            />
            <span className="text-[11px] text-ink-500">Not for clinical notes — those belong in your practice software.</span>
          </label>
          {note.trim() !== (c.note ?? "") && (
            <Button size="sm" disabled={pending} onClick={() => run(() => saveCaseNote(c.id, note))}>
              {pending ? "Saving…" : "Save note"}
            </Button>
          )}
          {events.length > 0 && (
            <div>
              <p className="mb-1 font-medium text-ink-700">History</p>
              <ol className="space-y-0.5 text-ink-500">
                {events.map((e, i) => (
                  <li key={i}>
                    {formatDate(e.created_at)} · {describeEvent(e)}
                    {e.by_name && <> · {e.by_name}</>}
                  </li>
                ))}
              </ol>
            </div>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(`Take ${c.patient_name} off the board? Use this if they've stopped treatment.`)) run(() => stopCase(c.id));
            }}
            className="text-clay-700 underline"
          >
            Remove from board
          </button>
        </div>
      )}
    </article>
  );
}

function describeEvent(e: CaseEvent): string {
  switch (e.kind) {
    case "started":
      return `Added at ${e.stage_name ?? "first stage"}`;
    case "moved":
      return `Moved to ${e.stage_name ?? "another stage"}`;
    case "completed":
      return "Completed";
    case "stopped":
      return "Taken off the board";
    case "reopened":
      return `Back to ${e.stage_name ?? "in treatment"}`;
  }
}
