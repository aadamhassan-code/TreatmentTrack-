import { cn } from "@/lib/utils";
import type { DisplayStatus } from "@/lib/treatment-status";

const config: Record<DisplayStatus, { label: string; className: string }> = {
  in_sequence: {
    label: "In sequence",
    className: "bg-sky text-ink-900",
  },
  converted: {
    label: "Booked",
    className: "bg-sage text-ink-900",
  },
  declined: {
    label: "Declined",
    className: "bg-teal-100 text-ink-700",
  },
  lost: {
    label: "Lost",
    className: "bg-rose text-ink-900",
  },
  future_intent: {
    label: "Paused",
    className: "bg-lilac text-ink-900",
  },
  opted_out: {
    label: "Opted out",
    className: "bg-rose text-ink-900",
  },
  messages_finished: {
    label: "Messages finished",
    className: "bg-teal-100 text-ink-700",
  },
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const c = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
        c.className
      )}
    >
      {c.label}
    </span>
  );
}
