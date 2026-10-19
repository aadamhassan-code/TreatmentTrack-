/**
 * How a quote's treatment is named in messages to the patient. A single
 * treatment is used as entered ("Dental implant"). A combined plan from a
 * practice-software import ("Composite Filling + Bridge Pontic - Acid Etch +
 * Crown - Porcelain ×2") reads as "treatment plan (crowns, bridge and
 * filling)" — staff screens keep the full detail.
 */

type Kind = { match: RegExp; one: string; many?: string };

// First match wins, so more specific names come first ("implant crown" is an implant).
const KINDS: Kind[] = [
  { match: /implant/, one: "implant", many: "implants" },
  { match: /veneer/, one: "veneer", many: "veneers" },
  { match: /crown/, one: "crown", many: "crowns" },
  { match: /bridge|pontic/, one: "bridge", many: "bridges" },
  { match: /denture/, one: "denture", many: "dentures" },
  { match: /inlay|onlay/, one: "inlay", many: "inlays" },
  { match: /root canal|endodont|\brct\b/, one: "root canal treatment" },
  { match: /extract/, one: "extraction", many: "extractions" },
  { match: /aligner|invisalign|ortho|brace|retainer/, one: "orthodontic treatment" },
  { match: /whiten|bleach/, one: "whitening" },
  { match: /bonding/, one: "composite bonding" },
  { match: /composite|filling|amalgam|restoration|glass ionomer/, one: "filling", many: "fillings" },
  { match: /perio|scale|scaling|root surface|gum|hygien/, one: "gum treatment" },
  { match: /post|core/, one: "post and core" },
];

function listJoin(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export function patientTreatmentName(treatmentType: string): string {
  const parts = treatmentType.split(" + ").map((p) => p.trim()).filter(Boolean);
  const repeated = /×\s*(\d+)\s*$/;
  if (parts.length <= 1 && !repeated.test(treatmentType)) return treatmentType.trim();

  // Count each kind of treatment, in the order first mentioned.
  const counts = new Map<string, { kind: Kind | null; label: string; count: number; most: number }>();
  for (const part of parts) {
    const n = Number(part.match(repeated)?.[1] ?? 1);
    const name = part.replace(repeated, "").replace(/…$/, "").trim();
    const lower = name.toLowerCase();
    const kind = KINDS.find((k) => k.match.test(lower)) ?? null;
    // Unknown items keep their own name, without any code detail after " - ".
    const key = kind?.one ?? lower.split(" - ")[0].trim();
    const entry = counts.get(key) ?? { kind, label: key, count: 0, most: 0 };
    entry.count += n;
    entry.most = Math.max(entry.most, n);
    counts.set(key, entry);
  }

  // An implant and its crown or abutment are one implant, so implants only
  // count as several when an item says so ("Implant ×2").
  const names = [...counts.values()].map(({ kind, label, count, most }) =>
    kind?.many && (kind.one === "implant" ? most > 1 : count > 1) ? kind.many : label
  );
  return `treatment plan (${listJoin(names)})`;
}
