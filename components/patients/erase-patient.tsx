"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { erasePatient } from "@/lib/actions/patients";

/** Two-step erase: open, type the patient's name, confirm. No browser pop-ups. */
export function ErasePatient({ patientId, patientName }: { patientId: string; patientName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="danger" size="sm" className="mt-4" onClick={() => setOpen(true)}>
        Erase patient…
      </Button>
    );
  }

  const matches = typed.trim().toLowerCase() === patientName.trim().toLowerCase();

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await erasePatient(patientId, typed);
          if (res.error) setError(res.error);
          else router.push("/patients?erased=1");
        });
      }}
    >
      <label htmlFor="confirm-erase" className="block text-sm text-ink-900">
        Type <strong>{patientName}</strong> to confirm. This can&rsquo;t be undone.
      </label>
      <input
        id="confirm-erase"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        className="w-full max-w-sm rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-clay-600 focus:outline-none focus:ring-1 focus:ring-clay-600"
      />
      {error && <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="danger" size="sm" disabled={!matches || pending}>
          {pending ? "Erasing…" : "Erase for good"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            setTyped("");
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
