"use client";

import { useRouter } from "next/navigation";

/** Narrows the dashboard (or the Cases board) to one dentist's patients. */
export function DentistFilter({
  dentists,
  value,
  myId,
  basePath = "/dashboard",
  mineLabel = "My quotes",
}: {
  dentists: { userId: string; name: string }[];
  value: string;
  /** Set when the viewer sees patients themselves, to offer "My quotes". */
  myId: string | null;
  /** Page to filter, which may already carry a query string (e.g. "/cases?board=…"). */
  basePath?: string;
  mineLabel?: string;
}) {
  const router = useRouter();
  const selected = myId && value === myId ? "me" : value;
  return (
    <select
      aria-label="Show quotes for"
      value={selected}
      onChange={(e) =>
        router.push(
          e.target.value ? `${basePath}${basePath.includes("?") ? "&" : "?"}dentist=${e.target.value}` : basePath
        )
      }
      className="rounded-lg border border-ink-900/15 bg-cream-0 px-3 py-2 text-sm"
    >
      <option value="">All dentists</option>
      {myId && <option value="me">{mineLabel}</option>}
      {dentists
        .filter((d) => d.userId !== myId)
        .map((d) => (
          <option key={d.userId} value={d.userId}>
            {d.name}
          </option>
        ))}
      <option value="unassigned">Not assigned</option>
    </select>
  );
}
