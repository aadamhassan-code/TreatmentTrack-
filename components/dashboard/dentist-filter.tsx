"use client";

import { useRouter } from "next/navigation";

/** Narrows the dashboard to one dentist's quotes. */
export function DentistFilter({
  dentists,
  value,
  myId,
}: {
  dentists: { userId: string; name: string }[];
  value: string;
  /** Set when the viewer sees patients themselves, to offer "My quotes". */
  myId: string | null;
}) {
  const router = useRouter();
  const selected = myId && value === myId ? "me" : value;
  return (
    <select
      aria-label="Show quotes for"
      value={selected}
      onChange={(e) => router.push(e.target.value ? `/dashboard?dentist=${e.target.value}` : "/dashboard")}
      className="rounded-lg border border-ink-900/15 bg-cream-0 px-3 py-2 text-sm"
    >
      <option value="">All dentists</option>
      {myId && <option value="me">My quotes</option>}
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
