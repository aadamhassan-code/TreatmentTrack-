import { cn } from "@/lib/utils";

function StatusPill({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        connected ? "bg-teal-100 text-teal-800" : "bg-ink-900/6 text-ink-500"
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-teal-600" : "bg-ink-300")}
      />
      {connected ? "Connected" : "Not connected yet"}
    </span>
  );
}

export function IntegrationRow({
  name,
  description,
  connected,
  hint,
}: {
  name: string;
  description: string;
  connected: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-900/6 py-4 last:border-0">
      <div>
        <p className="text-sm font-medium text-ink-900">{name}</p>
        <p className="mt-0.5 text-sm text-ink-500">{description}</p>
        {!connected && hint && (
          <p className="mt-1 text-xs text-ink-300">{hint}</p>
        )}
      </div>
      <StatusPill connected={connected} />
    </div>
  );
}
