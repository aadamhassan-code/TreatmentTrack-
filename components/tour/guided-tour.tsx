"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { markTourComplete } from "@/lib/actions/tour";
import type { TourStep } from "@/lib/tour";

/** Fired by the "Take the tour" button to start the tour again. */
export const START_TOUR_EVENT = "treatmenttrack:start-tour";

const CARD_WIDTH = 340;
const GAP = 14;
const PAD = 6;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findTarget(target?: string): HTMLElement | null {
  if (!target) return null;
  // Several elements can share a target (e.g. the desktop and phone menus);
  // use the one actually on screen.
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/**
 * First-login guided tour: dims the screen, highlights one thing at a time
 * and explains it in plain words, with Back / Next / Skip. Starts by itself
 * on the dashboard for anyone who hasn't finished or skipped it; the "Take
 * the tour" button in the menu starts it again.
 */
export function GuidedTour({ steps, autoStart }: { steps: TourStep[]; autoStart: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ width: 1024, height: 768 });

  const open = pathname === "/dashboard" && (replaying || (autoStart && !dismissed));
  const step = steps[Math.min(index, steps.length - 1)];

  // "Take the tour" from anywhere: go to the dashboard and start from the top.
  useEffect(() => {
    function start() {
      setIndex(0);
      setReplaying(true);
      router.push("/dashboard");
    }
    window.addEventListener(START_TOUR_EVENT, start);
    return () => window.removeEventListener(START_TOUR_EVENT, start);
  }, [router]);

  // Keep the highlight on the current step's element as the page scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setViewport({ width: window.innerWidth, height: window.innerHeight });
        const el = findTarget(step?.target);
        if (!el) return setRect(null);
        const r = el.getBoundingClientRect();
        setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
      });
    };
    const el = findTarget(step?.target);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "center" });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step, pathname]);

  const finish = useCallback(() => {
    setDismissed(true);
    setReplaying(false);
    setIndex(0);
    void markTourComplete();
  }, []);

  const next = useCallback(() => {
    if (index >= steps.length - 1) finish();
    else setIndex(index + 1);
  }, [index, steps.length, finish]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, back, finish]);

  if (!open || !step) return null;

  const isLast = index === steps.length - 1;
  const narrow = viewport.width < 768;
  const highlight = rect;

  // Put the card beside the highlighted element: right if there's room,
  // otherwise left, otherwise below; on phones and for intro steps, centred.
  let cardStyle: React.CSSProperties;
  if (!highlight) {
    cardStyle = narrow
      ? { left: 16, right: 16, bottom: 16 }
      : { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: CARD_WIDTH + 60 };
  } else if (narrow) {
    // Phones: full-width card on whichever half of the screen the highlight isn't.
    const inTopHalf = highlight.top + highlight.height / 2 < viewport.height / 2;
    cardStyle = inTopHalf ? { left: 16, right: 16, bottom: 16 } : { left: 16, right: 16, top: 16 };
  } else {
    const roomRight = viewport.width - (highlight.left + highlight.width) - GAP;
    const roomLeft = highlight.left - GAP;
    const top = Math.min(Math.max(16, highlight.top), viewport.height - 240);
    if (roomRight >= CARD_WIDTH + 16) cardStyle = { left: highlight.left + highlight.width + GAP, top, width: CARD_WIDTH };
    else if (roomLeft >= CARD_WIDTH + 16) cardStyle = { left: highlight.left - GAP - CARD_WIDTH, top, width: CARD_WIDTH };
    else
      cardStyle = {
        left: Math.min(Math.max(16, highlight.left), viewport.width - CARD_WIDTH - 16),
        top: Math.min(highlight.top + highlight.height + GAP, viewport.height - 240),
        width: CARD_WIDTH,
      };
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* Dim everything except the highlighted element; clicks outside the card are ignored. */}
      {highlight ? (
        <div
          className="pointer-events-none fixed rounded-xl ring-2 ring-gold-500 transition-all duration-200"
          style={{ ...highlight, boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55)" }}
        />
      ) : (
        <div className="fixed inset-0 bg-ink-900/55" />
      )}

      <div
        className="fixed rounded-xl border border-ink-900/10 bg-cream-0 p-5 shadow-xl"
        style={cardStyle}
        aria-live="polite"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
          Step {index + 1} of {steps.length}
        </p>
        <h2 id="tour-title" className="mt-1 font-display text-lg font-medium text-ink-900">
          {step.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={finish} className="text-sm text-ink-500 underline hover:text-ink-900">
            {isLast ? "Close" : "Skip tour"}
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <Button size="sm" variant="ghost" onClick={back}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={next} autoFocus>
              {isLast ? "Finish" : index === 0 ? "Show me" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** "Take the tour" button for the menu. */
export function TourReplayButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      data-tour="tour-replay"
      onClick={() => {
        onClick?.();
        window.dispatchEvent(new Event(START_TOUR_EVENT));
      }}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-teal-200 transition-colors hover:bg-cream-50/5 hover:text-cream-50"
    >
      <span aria-hidden className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px]">
        ?
      </span>
      Take the tour
    </button>
  );
}
