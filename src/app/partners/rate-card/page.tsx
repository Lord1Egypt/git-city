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

        <table className="mt-12 w-full border-collapse text-left">
          <thead>
            <tr className="border-b-[3px] border-border text-xs tracking-widest text-muted">
              <th scope="col" className="pb-3 font-normal">
                {t.cols.what}
              </th>
              <th scope="col" className="pb-3 font-normal">
                {t.cols.prize}
              </th>
              <th scope="col" className="pb-3 text-right font-normal">
                {t.cols.length}
              </th>
            </tr>
          </thead>
          {t.rows.map((row) => (
            <tbody key={row.what} className="border-b-[3px] border-border">
              <tr>
                <th scope="row" className="pt-6 text-xl font-normal text-cream sm:text-2xl">
                  {row.what}
                </th>
                <td className="pt-6 text-sm text-lime sm:text-base">{row.prize}</td>
                <td className="pt-6 text-right text-sm text-cream sm:text-base">{row.length}</td>
              </tr>
              <tr>
                <td
                  colSpan={3}
                  className="pt-3 pb-6 text-sm leading-relaxed text-muted normal-case"
                >
                  {row.gets}
                </td>
              </tr>
            </tbody>
          ))}
        </table>

        <div className="mt-8 flex flex-col gap-2 text-sm leading-relaxed normal-case">
          <p className="text-cream">{t.bonus}</p>
          <p className="text-muted">{t.prizeNote}</p>
        </div>

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
