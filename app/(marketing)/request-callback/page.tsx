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
      <h1 className="font-display text-4xl text-ink-900">
        {walkthrough ? "Book a walkthrough" : "Running more than 5 practices?"}
      </h1>
      <p className="mt-4 text-ink-500">
        {walkthrough
          ? "Leave your details and we'll call to show you and your team round TreatmentTrack: what patients receive, how consent is recorded, and how it would look with your own quotes. No obligation."
          : "Our self-serve plans cover up to 5 sites. Beyond that, tell us a bit about your group and we'll call you to work out group pricing, rollout support, and a single billing arrangement across your practices."}
      </p>
      <div className="mt-10">
        <RequestCallbackForm topic={walkthrough ? "walkthrough" : "sales"} />
      </div>
    </section>
  );
}
