import type { Metadata } from "next";
import { Check } from "lucide-react";
import { RequestCallbackForm, type CallbackTopic } from "@/components/forms/request-callback-form";

export const metadata: Metadata = {
  title: "Talk to us — TreatmentTrack",
};

const COPY: Record<CallbackTopic, { title: string; intro: string }> = {
  founding: {
    title: "Become a founding practice",
    intro:
      "We're opening TreatmentTrack to a small number of UK practices first. Leave your details and one of us — we're practising dentists — will call to show you how it works with your own quotes and get you set up.",
  },
  walkthrough: {
    title: "Book a walkthrough",
    intro:
      "Leave your details and we'll call to show you and your team round TreatmentTrack: what patients receive, how consent is recorded, and how it would look with your own quotes. No obligation.",
  },
  sales: {
    title: "Running more than 5 practices?",
    intro:
      "Our self-serve plans cover up to 5 sites. Beyond that, tell us a bit about your group and we'll call you to work out group pricing, rollout support, and a single billing arrangement across your practices.",
  },
};

const FOUNDING_PERKS = [
  "Founding-practice pricing",
  "We set it up with you, including your first import from Dentally, SOE or CareStack",
  "A direct line to the dentists building it, and a say in what comes next",
];

export default async function RequestCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const topic: CallbackTopic =
    params.topic === "founding" ? "founding" : params.topic === "walkthrough" ? "walkthrough" : "sales";
  const plan = typeof params.plan === "string" ? params.plan : undefined;
  const { title, intro } = COPY[topic];

  return (
    <section className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="font-display text-4xl text-ink-900">{title}</h1>
      <p className="mt-4 text-ink-500">{intro}</p>
      {topic === "founding" && (
        <ul className="mt-6 space-y-2">
          {FOUNDING_PERKS.map((perk) => (
            <li key={perk} className="flex items-start gap-2 text-sm text-ink-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
              {perk}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-10">
        <RequestCallbackForm topic={topic} plan={plan} />
      </div>
    </section>
  );
}
