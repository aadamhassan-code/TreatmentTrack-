import { cn } from "@/lib/utils";
import type { TreatmentStatus } from "@/lib/types";

const config: Record<TreatmentStatus, { label: string; className: string }> = {
  in_sequence: {
    label: "In sequence",
    className: "bg-teal-100 text-teal-800",
  },
  converted: {
    label: "Converted",
    className: "bg-gold-200 text-gold-700",
  },
  lost: {
    label: "Lost",
    className: "bg-clay-100 text-clay-700",
  },
  future_intent: {
    label: "Reminder set",
    className: "bg-ink-900/6 text-ink-700",
  },
};

export function StatusBadge({ status }: { status: TreatmentStatus }) {
  const c = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium tracking-wide",
        c.className
      )}
    >
      {c.label}
    </span>
  );
}
