import { formatGBP } from "@/lib/utils";
import type { MonthPoint } from "@/lib/performance";

/**
 * Booked revenue per month, last 12 months. One series in one hue, thin
 * bars with rounded tops anchored to the baseline, a hover tooltip per
 * bar, the latest month labelled directly, and the same figures as a
 * table for screen readers.
 */
export function RevenueChart({ points, title }: { points: MonthPoint[]; title: string }) {
  const max = Math.max(...points.map((p) => p.bookedPence), 1);
  const total = points.reduce((a, p) => a + p.bookedPence, 0);
  const last = points[points.length - 1];

  return (
    <figure className="rounded-xl border border-ink-900/8 bg-cream-0 p-5 md:p-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="text-sm text-ink-500">
          <span className="font-mono text-ink-900">{formatGBP(total)}</span> in 12 months
        </span>
      </figcaption>

      <div className="mt-6 flex h-44 items-end gap-[2px] border-b border-ink-900/15" aria-hidden>
        {points.map((p) => {
          const h = p.bookedPence > 0 ? Math.max(3, Math.round((p.bookedPence / max) * 100)) : 0;
          const isLast = p === last;
          return (
            <div key={p.month} className="group relative flex h-full flex-1 items-end justify-center">
              {/* Hover target is the full column, bigger than the bar. */}
              <div
                className={`w-full max-w-9 rounded-t-[4px] ${isLast ? "bg-teal-700" : "bg-teal-400"} group-hover:bg-teal-800`}
                style={{ height: `${h}%` }}
              />
              {isLast && p.bookedPence > 0 && (
                <span
                  className="absolute right-0 whitespace-nowrap font-mono text-[11px] text-ink-700 group-hover:hidden"
                  style={{ bottom: `calc(${h}% + 4px)` }}
                >
                  {formatGBP(p.bookedPence)}
                </span>
              )}
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-900 px-2.5 py-1.5 text-xs text-cream-50 shadow-lg group-hover:block">
                {p.label}: {formatGBP(p.bookedPence)}
                <span className="block text-cream-50/70">
                  {p.bookedCount} booking{p.bookedCount === 1 ? "" : "s"}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-[2px]" aria-hidden>
        {points.map((p, i) => (
          <span key={p.month} className="flex-1 text-center text-[11px] text-ink-500">
            {i % 2 === points.length % 2 || i === points.length - 1 ? p.label : ""}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Booked revenue</th>
            <th scope="col">Bookings</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.month}>
              <th scope="row">{p.month}</th>
              <td>{formatGBP(p.bookedPence)}</td>
              <td>{p.bookedCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
