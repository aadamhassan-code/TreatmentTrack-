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
        <p className="text-[13px] font-medium text-ink-500">
          {label}
        </p>
        {accent && (
          <span className="h-1.5 w-1.5 rounded-full bg-[#4dab6f]" aria-hidden />
        )}
      </div>
      <p
        className={cn(
          "mt-2 text-4xl font-semibold tracking-tight tabular-nums",
          accent ? "text-[#2b7a4b]" : "text-ink-900"
        )}
      >
        {value}
      </p>
      {caption && <p className="mt-1 text-sm text-ink-500">{caption}</p>}
    </div>
  );
}
