import { LinkButton } from "@/components/ui/button";
import { BoardDemo } from "@/components/marketing/board-demo";
import { BUILT_BY } from "@/components/marketing/built-by";

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20 pt-14 md:pt-20">
      <div className="max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-cream-0 py-1 pl-1 pr-3 text-[13px] text-ink-500">
          <span className="rounded-full bg-teal-900 px-2 py-0.5 text-xs font-semibold text-cream-50">{BUILT_BY}</span>
          For Dentally, SOE &amp; CareStack practices
        </p>
        <h1 className="mt-6 max-w-[16ch] font-display text-[40px] leading-[1.04] text-ink-900 sm:text-[54px] md:text-[64px]">
          Every quote, every case,{" "}
          <span className="bg-[linear-gradient(transparent_62%,var(--color-gold-200)_62%)] px-[0.08em]">one place.</span>
        </h1>
        <p className="mt-6 max-w-[48ch] text-lg leading-relaxed text-ink-500 md:text-[19px]">
          Follow up the patients who said &ldquo;I&rsquo;ll think about it&rdquo; with polite texts in your
          practice&rsquo;s name. Then track the ones who said yes, from consent to the final fit.
        </p>
        <div className="mt-8 flex flex-wrap gap-2.5">
          <LinkButton href="/signup" size="lg">
            Try it free
          </LinkButton>
          <LinkButton href="/request-callback?topic=walkthrough" variant="secondary" size="lg">
            Talk to us first
          </LinkButton>
        </div>
        <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-500">
          {["From £99/mo", "Data held in the UK", "Opt-out on every message"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-14">
        <BoardDemo />
      </div>
    </section>
  );
}
