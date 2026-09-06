import type { Metadata } from "next";
import { RequestCallbackForm } from "@/components/forms/request-callback-form";

export const metadata: Metadata = {
  title: "Request a callback — TreatmentTrack",
};

export default function RequestCallbackPage() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
        Multisite groups
      </p>
      <h1 className="mt-3 font-display text-4xl font-medium text-ink-900">
        Running more than 5 practices?
      </h1>
      <p className="mt-4 text-ink-500">
        Our self-serve plans cover up to 5 sites. Beyond that, tell us a bit
        about your group and we&rsquo;ll call you to work out group pricing,
        rollout support, and a single billing arrangement across your
        practices.
      </p>
      <div className="mt-10">
        <RequestCallbackForm />
      </div>
    </section>
  );
}
