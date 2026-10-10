"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  addLocation,
  changeMemberRole,
  inviteTeamMember,
  removeMember,
  type TeamActionResult,
} from "@/lib/actions/team";

const inputClass =
  "w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700";

function Feedback({ result }: { result: TeamActionResult | null }) {
  if (result?.error) return <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{result.error}</p>;
  if (result?.message) return <p className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-800">{result.message}</p>;
  return null;
}

export function InviteForm() {
  const [result, setResult] = useState<TeamActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const res = await inviteTeamMember(data);
      setResult(res);
      if (!res.error) form.reset();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm font-semibold text-ink-900">Invite someone</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <input name="email" type="email" required placeholder="name@yourpractice.co.uk" className={inputClass} aria-label="Email" />
        <select name="role" defaultValue="staff" className={inputClass} aria-label="Role">
          <option value="staff">Staff</option>
          <option value="owner">Owner</option>
        </select>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send invite"}
        </Button>
      </div>
      <Feedback result={result} />
    </form>
  );
}

export function MemberActions({
  memberId,
  role,
  isSelf,
}: {
  memberId: string;
  role: "owner" | "staff";
  isSelf: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (isSelf) return <span className="text-sm capitalize text-ink-700">{role}</span>;

  function run(action: () => Promise<TeamActionResult>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <select
          value={role}
          disabled={pending}
          onChange={(e) => run(() => changeMemberRole(memberId, e.target.value as "owner" | "staff"))}
          className="rounded-lg border border-ink-900/15 bg-cream-0 px-2.5 py-1.5 text-sm"
          aria-label="Role"
        >
          <option value="staff">Staff</option>
          <option value="owner">Owner</option>
        </select>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (confirm("Remove this person from the practice? They'll lose access straight away.")) {
              run(() => removeMember(memberId));
            }
          }}
        >
          Remove
        </Button>
      </div>
      {error && <p className="text-xs text-clay-700">{error}</p>}
    </div>
  );
}

export function AddLocationForm() {
  const [result, setResult] = useState<TeamActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const res = await addLocation(data);
      setResult(res);
      if (!res.error) form.reset();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm font-semibold text-ink-900">Add a location</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input name="name" required placeholder="e.g. Smile Dental — Leeds" className={inputClass} aria-label="Location name" />
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add location"}
        </Button>
      </div>
      <p className="text-xs text-ink-500">
        You&rsquo;ll be its owner. It starts with the default message templates and its own empty patient list;
        invite its team from here once you&rsquo;ve switched to it.
      </p>
      <Feedback result={result} />
    </form>
  );
}
