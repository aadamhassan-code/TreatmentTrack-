import { CheckCircle2 } from "lucide-react";
import { stripe, isStripeConfigured } from "@/lib/stripe";

export default async function SignupSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  let email: string | undefined;

  if (session_id && isStripeConfigured()) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      email = session.customer_details?.email ?? undefined;
    } catch {
      // fall through to the generic message
    }
  }

  return (
    <div className="text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-teal-600" />
      <h1 className="mt-4 font-display text-3xl font-medium text-ink-900">
        Payment received
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-500">
        We&rsquo;re setting up your practice now. Check{" "}
        {email ? <span className="font-medium text-ink-900">{email}</span> : "your inbox"}{" "}
        for an email from TreatmentTrack with a link to set your password —
        it usually arrives within a minute.
      </p>
    </div>
  );
}
