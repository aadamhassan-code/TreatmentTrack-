import Link from "next/link";
import { LedgerStat } from "@/components/ui/ledger-stat";
import { CaseBoardView } from "@/components/cases/case-board";
import { AddCaseForm } from "@/components/cases/add-case-form";
import { DentistFilter } from "@/components/dashboard/dentist-filter";
import { listTreatingDentists, requireCurrentPractice } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { periodStart } from "@/lib/reports";
import { cn, formatGBP, ukDate } from "@/lib/utils";
import { daysAgo, isStuck, type CaseBoard, type CaseEvent, type CaseRow, type CaseStage } from "@/lib/cases";

const CASE_COLUMNS =
  "id, board_id, stage_id, status, treatment_id, patient_name, treatment_type, value_pence, dentist_user_id, note, stage_entered_at, completed_at, created_at";

/** Completed cases stay in the Completed column this long. */
const COMPLETED_SHOWN_DAYS = 30;

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { practice, role, userId, treatsPatients } = await requireCurrentPractice();
  const supabase = await createClient();
  const isDentist = role === "dentist";
  const params = await searchParams;

  const dentists = isDentist ? [] : await listTreatingDentists(practice.id);
  const dentistNames = Object.fromEntries(dentists.map((d) => [d.userId, d.name]));
  const rawFilter = params.dentist;
  const filter = typeof rawFilter === "string" ? (rawFilter === "me" ? userId : rawFilter) : "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoped = <Q extends { eq: any; is: any }>(q: Q): Q =>
    !filter || isDentist ? q : filter === "unassigned" ? q.is("dentist_user_id", null) : q.eq("dentist_user_id", filter);

  const completedSince = daysAgo(COMPLETED_SHOWN_DAYS);
  const [{ data: boardRows }, { data: stageRows }, cases] = await Promise.all([
    supabase.from("case_boards").select("id, name, keywords, is_default, position").eq("practice_id", practice.id).order("position"),
    supabase.from("case_stages").select("id, board_id, name, expected_days, position").eq("practice_id", practice.id).order("position"),
    fetchAll<CaseRow>((from, to) =>
      scoped(supabase.from("cases").select(CASE_COLUMNS).eq("practice_id", practice.id))
        .or(`status.eq.active,and(status.eq.completed,completed_at.gte.${completedSince})`)
        .order("stage_entered_at")
        .order("id")
        .range(from, to)
    ),
  ]);

  const stages = (stageRows ?? []) as CaseStage[];
  const boards: CaseBoard[] = (boardRows ?? []).map((b) => ({
    ...(b as Omit<CaseBoard, "stages">),
    stages: stages.filter((s) => s.board_id === b.id),
  }));
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const active = cases.filter((c) => c.status === "active");
  const stuck = active.filter((c) => isStuck(c, c.stage_id ? stageById.get(c.stage_id) : undefined));

  // Open the board asked for, else the first one with patients on it.
  const requested = typeof params.board === "string" ? params.board : "";
  const board =
    boards.find((b) => b.id === requested) ?? boards.find((b) => active.some((c) => c.board_id === b.id)) ?? boards[0];
  const boardCases = board ? cases.filter((c) => c.board_id === board.id) : [];

  const { data: eventRows } = boardCases.length
    ? await supabase
        .from("case_events")
        .select("case_id, kind, stage_name, by_name, created_at")
        .in("case_id", boardCases.map((c) => c.id).slice(0, 500))
        .order("created_at")
    : { data: [] };

  const monthStart = periodStart("month")!;
  const completedThisMonth = cases.filter((c) => c.status === "completed" && c.completed_at && ukDate(c.completed_at) >= monthStart);
  const dentistQuery = typeof rawFilter === "string" ? `&dentist=${encodeURIComponent(rawFilter)}` : "";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink-900">{isDentist ? "My cases" : "Cases"}</h1>
          <p className="mt-1 text-sm text-ink-500">
            Where each booked patient is in their treatment.
            {!isDentist && filter && filter !== userId && (
              <> · {filter === "unassigned" ? "Not assigned to a dentist" : (dentistNames[filter] ?? "One dentist")}</>
            )}
          </p>
        </div>
        {!isDentist && dentists.length > 0 && board && (
          <DentistFilter
            dentists={dentists}
            value={filter}
            myId={treatsPatients ? userId : null}
            basePath={`/cases?board=${board.id}`}
            mineLabel="My cases"
          />
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <LedgerStat
          label="In treatment"
          value={String(active.length)}
          caption={`${formatGBP(active.reduce((s, c) => s + c.value_pence, 0))} of treatment under way`}
        />
        <LedgerStat
          label="Overdue"
          value={String(stuck.length)}
          caption={stuck.length ? "at a stage longer than usual — check they're booked in" : "nobody is stuck"}
        />
        <LedgerStat
          label="Completed this month"
          value={formatGBP(completedThisMonth.reduce((s, c) => s + c.value_pence, 0))}
          caption={`${completedThisMonth.length} case${completedThisMonth.length === 1 ? "" : "s"} finished`}
          accent
        />
      </div>

      {boards.length === 0 || !board ? (
        <p className="text-sm text-ink-500">No boards yet. A practice owner can add them in Settings.</p>
      ) : (
        <>
          <nav data-tour="case-boards" className="flex gap-1 overflow-x-auto rounded-lg border border-ink-900/10 bg-cream-0 p-1" aria-label="Boards">
            {boards.map((b) => {
              const count = active.filter((c) => c.board_id === b.id).length;
              const late = stuck.filter((c) => c.board_id === b.id).length;
              return (
                <Link
                  key={b.id}
                  href={`/cases?board=${b.id}${dentistQuery}`}
                  aria-current={b.id === board.id ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium",
                    b.id === board.id ? "bg-teal-900 text-cream-50" : "text-ink-700 hover:bg-ink-900/5"
                  )}
                >
                  {b.name}
                  <span className={cn("text-xs", b.id === board.id ? "text-teal-200" : "text-ink-500")}>{count}</span>
                  {late > 0 && (
                    <span className="rounded-full bg-clay-600 px-1.5 text-[11px] font-semibold text-cream-50" title={`${late} overdue`}>
                      {late}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <AddCaseForm
            boards={boards.map((b) => ({ id: b.id, name: b.name, stages: b.stages.map((s) => ({ id: s.id, name: s.name })) }))}
            defaultBoardId={board.id}
            dentists={isDentist ? null : dentists}
          />

          <CaseBoardView
            board={board}
            boards={boards.map((b) => ({ id: b.id, name: b.name }))}
            cases={boardCases}
            events={(eventRows ?? []) as CaseEvent[]}
            dentistNames={isDentist ? undefined : dentistNames}
            completedShownDays={COMPLETED_SHOWN_DAYS}
          />

          <p className="text-xs text-ink-500">
            Patients appear here when their quote is marked Booked. This board is for tracking progress only — keep
            clinical notes in your practice software.
          </p>
        </>
      )}
    </div>
  );
}
