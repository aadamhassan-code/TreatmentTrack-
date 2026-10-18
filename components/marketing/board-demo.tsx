"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type DemoCard = { id: string; name: string; value: string; meta: string; late?: string };

const CARDS: Record<string, DemoCard> = {
  tom: { id: "tom", name: "Tom Ellis", value: "£2,450", meta: "Dr Khan" },
  priya: { id: "priya", name: "Priya Shah", value: "£2,800", meta: "Dr Hassan" },
  mark: { id: "mark", name: "Mark Owen", value: "£5,600", meta: "Dr Khan" },
  ann: { id: "ann", name: "Ann Riley", value: "£2,600", meta: "day 88", late: "Overdue · usually 90 days" },
  raj: { id: "raj", name: "Raj Patel", value: "£3,100", meta: "12 Oct" },
  lucy: { id: "lucy", name: "Lucy Hart", value: "£2,450", meta: "3 Oct" },
};

const COLUMNS = [
  { name: "Consultation", tag: "bg-lilac" },
  { name: "Consent signed", tag: "bg-sky" },
  { name: "Implant placed", tag: "bg-butter" },
  { name: "Healing", tag: "bg-rose" },
  { name: "Completed", tag: "bg-sage" },
];

const START: string[][] = [["tom"], ["priya", "mark"], [], ["ann"], ["raj", "lucy"]];

type Box = { x: number; y: number; w: number };

/**
 * The homepage's live example: a Cases board where a team member drags a
 * patient to the next stage, a card goes overdue and gets finished. Plays
 * on a loop; holds still for people who prefer reduced motion.
 */
export function BoardDemo() {
  const [cols, setCols] = useState(START);
  const [cursor, setCursor] = useState({ x: 70, y: 75, pct: true });
  const [lifted, setLifted] = useState<string | null>(null);
  const [ghost, setGhost] = useState<(Box & { id: string }) | null>(null);
  const [overdue, setOverdue] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const cardEls = useRef<Record<string, HTMLDivElement | null>>({});
  const headEls = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let alive = true;
    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => setTimeout(() => (alive ? resolve() : reject(new Error("stopped"))), ms));
    const box = (el: Element | null | undefined): Box => {
      const a = el!.getBoundingClientRect();
      const r = root.current!.getBoundingClientRect();
      return { x: a.left - r.left, y: a.top - r.top, w: a.width };
    };
    const point = (x: number, y: number) => setCursor({ x, y, pct: false });

    async function drag(id: string, to: number) {
      const r = box(cardEls.current[id]);
      point(r.x + r.w * 0.6, r.y + 28);
      await wait(1000);
      setLifted(id);
      await wait(250);
      setGhost({ id, ...r });
      await wait(40);
      const h = box(headEls.current[to]);
      const target = { x: h.x, y: h.y + 30, w: r.w };
      setGhost({ id, ...target });
      point(target.x + r.w * 0.6, target.y + 28);
      await wait(950);
      setCols((c) => c.map((list, i) => (i === to ? [id, ...list.filter((x) => x !== id)] : list.filter((x) => x !== id))));
      setGhost(null);
      setLifted(null);
    }

    (async () => {
      try {
        for (;;) {
          await wait(1200);
          await drag("priya", 2);
          await wait(900);
          const a = box(cardEls.current.ann);
          point(a.x + a.w - 30, a.y + 16);
          await wait(900);
          setOverdue(true);
          await wait(2400);
          await drag("ann", 4);
          await wait(2800);
          setCols(START);
          setOverdue(false);
        }
      } catch {
        // unmounted
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const renderCard = (id: string, ghostStyle?: React.CSSProperties) => {
    const c = CARDS[id];
    const isLate = id === "ann" && overdue;
    return (
      <div
        key={ghostStyle ? `ghost-${id}` : id}
        ref={ghostStyle ? undefined : (el) => void (cardEls.current[id] = el)}
        style={ghostStyle ?? (ghost?.id === id ? { visibility: "hidden" } : undefined)}
        className={cn(
          "mb-2 rounded-lg border bg-white px-3 py-2.5 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[box-shadow,transform,border-color] duration-200",
          isLate ? "border-clay-500/50" : "border-teal-100",
          (lifted === id || ghostStyle) && "rotate-2 shadow-[0_14px_30px_-10px_rgba(0,0,0,0.25)]",
          ghostStyle && "absolute z-10 transition-[left,top] duration-[900ms] ease-[cubic-bezier(.6,0,.2,1)]"
        )}
      >
        <b className="block font-semibold">{c.name}</b>
        <div className="mt-1.5 flex justify-between font-mono text-[11.5px] text-ink-500">
          <span>{c.value}</span>
          <span>{isLate ? "day 91" : c.meta}</span>
        </div>
        {isLate && <p className="mt-1.5 text-[11.5px] font-medium text-clay-600">{c.late}</p>}
      </div>
    );
  };

  return (
    <div
      ref={root}
      role="img"
      aria-label="Example Cases board: a team member moves a patient from Consent signed to Implant placed, and a patient who has been healing longer than usual is flagged as overdue."
      className="relative overflow-hidden rounded-2xl border border-teal-100 bg-white text-left shadow-[0_30px_80px_-30px_rgba(0,0,0,0.18)]"
    >
      <div className="flex h-9 items-center gap-1.5 border-b border-teal-100 px-3.5 text-xs text-ink-500">
        <i className="h-2.5 w-2.5 rounded-full bg-teal-100" />
        <i className="h-2.5 w-2.5 rounded-full bg-teal-100" />
        <i className="h-2.5 w-2.5 rounded-full bg-teal-100" />
        <span className="ml-3">Cases · Riverside Dental</span>
      </div>
      <div className="px-5 pb-1 pt-4 text-lg font-semibold tracking-tight">🦷 Implants</div>
      <div className="flex gap-1 px-5 pb-3 pt-1 text-[13px] text-ink-500">
        <span className="rounded-md bg-teal-50 px-2.5 py-1 font-semibold text-ink-900">Implants 6</span>
        <span className="px-2.5 py-1">Aligners &amp; ortho 4</span>
        <span className="hidden px-2.5 py-1 sm:inline">Crowns &amp; veneers 9</span>
        <span className="hidden px-2.5 py-1 sm:inline">Whitening 2</span>
      </div>
      <div className="grid grid-cols-[repeat(5,minmax(150px,1fr))] gap-3 overflow-x-auto px-5 pb-6">
        {COLUMNS.map((col, i) => (
          <div key={col.name} className="min-h-[230px]">
            <h5
              ref={(el) => void (headEls.current[i] = el)}
              className="mb-2.5 flex items-center gap-1.5 text-xs text-ink-500"
            >
              <span className={cn("rounded px-1.5 py-px text-ink-900", col.tag)}>{col.name}</span>
              {cols[i].length}
            </h5>
            {cols[i].map((id) => renderCard(id))}
          </div>
        ))}
      </div>
      {ghost && renderCard(ghost.id, { left: ghost.x, top: ghost.y, width: ghost.w })}
      <div
        aria-hidden
        className="pointer-events-none absolute z-20 transition-[left,top] duration-[900ms] ease-[cubic-bezier(.6,0,.2,1)] motion-reduce:hidden"
        style={cursor.pct ? { left: `${cursor.x}%`, top: `${cursor.y}%` } : { left: cursor.x, top: cursor.y }}
      >
        <svg width="18" height="22" viewBox="0 0 18 22">
          <path d="M1 1l15 11-6.5 1.2L13 21l-3 1-3.5-7.8L1 18z" fill="#191919" stroke="#fff" strokeWidth="1.4" />
        </svg>
        <span className="absolute left-4 top-[18px] whitespace-nowrap rounded-[5px] bg-[#2383E2] px-1.5 py-0.5 text-[11px] font-semibold text-white">
          Sam · TCO
        </span>
      </div>
    </div>
  );
}
