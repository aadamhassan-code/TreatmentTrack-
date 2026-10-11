import type { Metadata } from "next";
import { RequestCallbackForm } from "@/components/forms/request-callback-form";

export const metadata: Metadata = {
  title: "Talk to us — TreatmentTrack",
};

export default async function RequestCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const walkthrough = (await searchParams).topic === "walkthrough";

  return (
    <section className="mx-auto max-w-2xl px-6 py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
        {walkthrough ? "Talk to us first" : "Multisite groups"}
      </p>
      <h1 className="mt-3 font-display text-4xl font-medium text-ink-900">
        {walkthrough ? "Want to see it before you decide?" : "Running more than 5 practices?"}
      </h1>
      <p className="mt-4 text-ink-500">
        {walkthrough
          ? "Leave your details and we'll call to walk you and your team through TreatmentTrack — how follow-ups read to patients, how consent is recorded, and what it would look like on your own quotes. No obligation."
          : "Our self-serve plans cover up to 5 sites. Beyond that, tell us a bit about your group and we'll call you to work out group pricing, rollout support, and a single billing arrangement across your practices."}
      </p>
      <div className="mt-10">
        <RequestCallbackForm />
      </div>
    </section>
  );
}
