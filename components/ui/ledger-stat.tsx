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
        "ledger-lines rounded-xl border border-ink-900/8 bg-cream-0 px-4 pt-3.5 pb-4 sm:px-5 sm:pt-4 sm:pb-5",
        className
      )}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-medium text-ink-500">
          {label}
        </p>
        {accent && (
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden />
        )}
      </div>
      <p
        className={cn(
          "mt-1.5 text-2xl leading-tight font-semibold tracking-tight tabular-nums sm:text-[28px]",
          accent ? "text-teal-600" : "text-ink-900"
        )}
      >
        {value}
      </p>
      {caption && <p className="mt-1 text-[13px] leading-snug text-ink-500 sm:text-sm">{caption}</p>}
    </div>
  );
}
