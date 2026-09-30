import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { langFromAcceptLanguage } from "../copy";
import { RATE_COPY } from "./copy";

async function getCopy() {
  const h = await headers();
  return RATE_COPY[langFromAcceptLanguage(h.get("accept-language"))];
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getCopy();
  return {
    title: t.meta.title,
    description: t.meta.description,
    openGraph: {
      title: t.meta.title,
      description: t.meta.description,
      siteName: "Git City",
      type: "website",
    },
  };
}

// One table like a creator's rate card: a row per sponsorship, paid in prizes.
export default async function RateCardPage() {
  const t = await getCopy();

  return (
    <main className="min-h-screen bg-bg pb-24 font-pixel uppercase text-warm">
      <nav className="mx-auto flex max-w-4xl items-center px-4 py-4 sm:px-6">
        <Link href="/partners" className="text-sm text-muted transition-colors hover:text-cream">
          &larr; {t.back}
        </Link>
      </nav>

      <div className="mx-auto max-w-4xl border-t-[3px] border-border px-4 pt-14 sm:px-6 sm:pt-20">
        <p className="text-xs tracking-widest text-muted sm:text-sm">{t.kicker}</p>
        <h1 className="mt-4 text-4xl text-cream sm:text-6xl">{t.title}</h1>
        <p className="mt-5 text-base text-lime normal-case sm:text-lg">{t.sub}</p>

        <div className="mt-12 flex flex-col gap-4">
          {t.rows.map((row) => (
            <section key={row.what} className="border-[3px] border-border bg-bg-raised">
              <header className="flex items-baseline justify-between gap-4 border-b-[3px] border-border px-5 py-4 sm:px-6">
                <h2 className="text-2xl text-cream sm:text-3xl">{row.what}</h2>
                <span className="text-sm text-muted">{row.length}</span>
              </header>
              <div className="grid sm:grid-cols-[2fr_3fr]">
                <div className="flex flex-col gap-2 border-b-[3px] border-border px-5 py-5 sm:border-r-[3px] sm:border-b-0 sm:px-6">
                  <p className="text-xs tracking-widest text-muted">{t.cost}</p>
                  <p className="text-3xl text-lime">{row.cost}</p>
                  <p className="text-sm leading-relaxed text-muted normal-case">{row.costNote}</p>
                </div>
                <div className="flex flex-col gap-3 px-5 py-5 sm:px-6">
                  <p className="text-xs tracking-widest text-muted">{t.gets}</p>
                  <ul className="flex flex-col gap-2">
                    {row.gets.map((line) => (
                      <li
                        key={line}
                        className="flex gap-2 text-sm leading-relaxed text-cream normal-case"
                      >
                        <span className="text-lime" aria-hidden="true">
                          +
                        </span>
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2 text-sm leading-relaxed normal-case">
          <p className="text-cream">
            <span className="text-lime">{t.bonus.label}:</span> {t.bonus.text}
          </p>
          <p className="text-muted">{t.prizeNote}</p>
        </div>

        <section className="mt-14 border-t-[3px] border-border pt-10">
          <h2 className="text-2xl text-cream sm:text-3xl">{t.how.title}</h2>
          <ol className="mt-6 flex flex-col gap-4">
            {t.how.steps.map((step, i) => (
              <li
                key={step}
                className="flex gap-4 text-sm leading-relaxed text-cream normal-case sm:text-base"
              >
                <span className="w-6 shrink-0 text-lime">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-5 pl-10 text-sm leading-relaxed text-muted normal-case">
            {t.how.delivery}
          </p>
        </section>

        <a
          href="/partners#contact"
          className="btn-press mt-12 inline-block bg-lime px-6 py-3 text-sm tracking-widest text-bg sm:text-base"
        >
          {t.cta}
        </a>
      </div>
    </main>
  );
}
