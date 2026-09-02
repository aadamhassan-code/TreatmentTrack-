import { cn } from "@/lib/utils";

export function LedgerStat({
  label,
  value,
  caption,
  accent = false,
  className,
}: {
  label: string;
  value: string;
  caption?: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "ledger-lines rounded-xl border border-ink-900/8 bg-cream-0 px-6 pt-5 pb-6",
        className
      )}
    >
      <div className="flex items-baseline justify-between">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
          {label}
        </p>
        {accent && (
          <span className="h-1.5 w-1.5 rounded-full bg-gold-500" aria-hidden />
        )}
      </div>
      <p
        className={cn(
          "mt-2 font-mono text-4xl font-medium tabular-nums",
          accent ? "text-gold-700" : "text-teal-900"
        )}
      >
        {value}
      </p>
      {caption && <p className="mt-1 text-sm text-ink-500">{caption}</p>}
    </div>
  );
}
