import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { langFromAcceptLanguage } from "../copy";
import { SPONSOR_COPY } from "./copy";
import { getDiscover, getTownCatalog } from "@/lib/towns/discover";

async function getCopy() {
  const h = await headers();
  return SPONSOR_COPY[langFromAcceptLanguage(h.get("accept-language"))];
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

type SponsorTown = { slug: string; name: string; cover: string | null };

// The towns with the most visitors this week, for a sponsor to pick from.
// Numbers stay off the page: only the order says which is busiest.
async function topTowns(): Promise<SponsorTown[]> {
  try {
    const [catalog, discover] = await Promise.all([getTownCatalog(), getDiscover(null)]);
    const covers = new Map(discover.all.map((t) => [t.slug, t.cover]));
    return catalog
      .filter((t) => t.visitors_7d > 0)
      .sort((a, b) => b.visitors_7d - a.visitors_7d)
      .slice(0, 6)
      .map((t) => ({ slug: t.slug, name: t.name, cover: covers.get(t.slug) ?? null }));
  } catch {
    return [];
  }
}

export default async function SponsorPage() {
  const t = await getCopy();
  const towns = await topTowns();
  const contact = "/partners#contact";

  return (
    <main className="min-h-screen bg-bg pb-24 font-pixel uppercase text-warm">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/partners" className="text-sm text-muted transition-colors hover:text-cream">
          &larr; {t.nav.back}
        </Link>
        <span className="text-xs tracking-widest text-muted">{t.nav.label}</span>
      </nav>

      <header className="border-t-[3px] border-border">
        <div className="mx-auto max-w-6xl px-4 pt-14 pb-16 sm:px-6 sm:pt-24 sm:pb-20">
          <p className="text-xs tracking-widest text-muted sm:text-sm">{t.hero.kicker}</p>
          <h1 className="mt-5 max-w-4xl text-4xl leading-[1.25] text-cream sm:text-6xl">
            {t.hero.titleStart} <span className="text-lime">{t.hero.titleAccent}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-cream normal-case sm:text-lg">
            {t.hero.sub}
          </p>
          <a
            href={contact}
            className="btn-press mt-8 inline-block bg-lime px-6 py-3 text-sm tracking-widest text-bg sm:text-base"
          >
            {t.hero.cta}
          </a>
        </div>
      </header>

      <section className="border-t-[3px] border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-xs tracking-widest text-muted sm:text-sm">{t.offers.kicker}</p>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {t.offers.items.map((offer) => (
              <article
                key={offer.id}
                className="flex flex-col border-[3px] border-border bg-bg-raised"
              >
                <div className="border-b-[3px] border-border p-6">
                  <h2 className="text-3xl text-cream sm:text-4xl">{offer.name}</h2>
                  <p className="mt-3 text-sm text-lime">{offer.example}</p>
                </div>
                <div className="grid flex-1 gap-6 p-6 sm:grid-cols-2">
                  <div className="flex flex-col gap-3">
                    <p className="text-xs tracking-widest text-muted">{t.offers.you}</p>
                    {offer.give.map((line) => (
                      <p key={line} className="text-sm leading-relaxed text-cream normal-case">
                        {line}
                      </p>
                    ))}
                  </div>
                  <div className="flex flex-col gap-3">
                    <p className="text-xs tracking-widest text-muted">{t.offers.get}</p>
                    <ul className="flex flex-col gap-2">
                      {offer.get.map((line) => (
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
                <p className="border-t-[3px] border-border px-6 py-4 text-xs tracking-widest text-muted">
                  {t.offers.length}: <span className="text-cream">{offer.length}</span>
                </p>
              </article>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {[t.bonus, t.prizes].map((block) => (
              <div
                key={block.label}
                className="flex flex-col gap-2 border-l-[3px] border-lime px-5 py-2"
              >
                <p className="text-xs tracking-widest text-lime">{block.label}</p>
                <p className="text-sm leading-relaxed text-warm normal-case">{block.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {towns.length > 0 && (
        <section className="border-t-[3px] border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <p className="text-xs tracking-widest text-muted sm:text-sm">{t.towns.kicker}</p>
            <h2 className="mt-4 text-3xl leading-tight text-cream sm:text-4xl">{t.towns.title}</h2>
            <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {towns.map((town, i) => (
                <li key={town.slug}>
                  <Link
                    href={`/town/${town.slug}`}
                    className="group flex flex-col border-[3px] border-border bg-bg-raised transition-colors hover:border-lime"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-bg">
                      {town.cover && (
                        // eslint-disable-next-line @next/next/no-img-element -- town cover photos from storage
                        <img src={town.cover} alt="" className="h-full w-full object-cover" />
                      )}
                      <span className="absolute top-2 left-2 bg-bg/90 px-2 py-1 text-xs text-lime">
                        #{i + 1}
                      </span>
                    </div>
                    <p className="px-4 py-3 text-sm text-cream group-hover:text-lime">
                      {town.name}
                    </p>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <section className="border-t-[3px] border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-20">
          <h2 className="text-3xl leading-tight text-cream sm:text-4xl">{t.cta.title}</h2>
          <a
            href={contact}
            className="btn-press bg-lime px-6 py-3 text-sm tracking-widest text-bg sm:text-base"
          >
            {t.cta.button}
          </a>
        </div>
      </section>
    </main>
  );
}
