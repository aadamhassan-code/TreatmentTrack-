"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
}

/**
 * A small "more actions" menu: one button that opens a list. Closes on
 * outside click or Escape; keyboard reachable.
 */
export function ActionsMenu({ items, label, disabled }: { items: MenuItem[]; label: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  function toggle() {
    if (open) return setOpen(false);
    const r = button.current?.getBoundingClientRect();
    if (r) {
      // Open upwards when there isn't room below (e.g. the last row of a table).
      const up = window.innerHeight - r.bottom < 48 * items.length + 16;
      setPos({ top: up ? r.top - 4 : r.bottom + 4, right: window.innerWidth - r.right, up });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        ref={button}
        onClick={toggle}
        className="rounded-md p-1.5 text-ink-500 hover:bg-teal-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-gold-500 disabled:opacity-50"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open && pos && (
        <ul
          id={id}
          role="menu"
          style={{ position: "fixed", right: pos.right, top: pos.top, transform: pos.up ? "translateY(-100%)" : undefined }}
          className="z-50 min-w-44 overflow-hidden rounded-lg border border-ink-900/10 bg-cream-0 py-1 shadow-lg shadow-ink-900/10"
        >
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "block w-full px-3.5 py-2 text-left text-sm hover:bg-teal-50",
                  item.tone === "danger" ? "text-clay-700" : "text-ink-900"
                )}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
