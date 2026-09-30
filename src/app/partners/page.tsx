import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import {
  ABOUT_LINKS,
  COPY,
  PRESS,
  SPONSORS,
  langFromAcceptLanguage,
  type Copy,
  type Lang,
} from "./copy";
import GithubCarousel from "./GithubCarousel";
import PlayCarousel from "./PlayCarousel";
import BrandPreview from "./BrandPreview";
import ContactForm from "./ContactForm";

async function getLang(): Promise<Lang> {
  const h = await headers();
  return langFromAcceptLanguage(h.get("accept-language"));
}

async function getCopy(): Promise<Copy> {
  return COPY[await getLang()];
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

export default async function PartnersPage() {
  const lang = await getLang();
  const t = COPY[lang];
  return (
    <main className="min-h-screen bg-bg pb-24 font-pixel uppercase text-warm">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="text-sm text-muted transition-colors hover:text-cream">
          &larr; {t.nav.back}
        </Link>
        <span className="text-xs tracking-widest text-muted">{t.nav.label}</span>
      </nav>

      <header className="border-t-[3px] border-border">
        <div className="mx-auto max-w-6xl px-4 pt-14 pb-16 sm:px-6 sm:pt-24 sm:pb-24">
          <p className="text-xs tracking-widest text-muted sm:text-sm">{t.hero.kicker}</p>
          <h1 className="mt-5 max-w-4xl text-4xl leading-[1.25] text-cream sm:text-6xl">
            {t.hero.titleStart} <span className="text-lime">{t.hero.titleAccent}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-cream normal-case sm:text-lg">
            {t.hero.sub}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#contact"
              className="btn-press bg-lime px-6 py-3 text-sm tracking-widest text-bg sm:text-base"
            >
              {t.hero.cta}
            </a>
            <Link
              href="/"
              className="btn-press border-[3px] border-border px-6 py-2.5 text-sm tracking-widest text-muted transition-colors hover:text-cream sm:text-base"
            >
              {t.hero.secondary}
            </Link>
          </div>
        </div>
      </header>

      <section className="border-t-[3px] border-border">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {t.proof.stats.map((stat, i) => (
              <div key={stat.label} className="flex flex-col-reverse justify-end gap-2">
                <dt className="text-sm text-muted normal-case sm:text-base">{stat.label}</dt>
                <dd
                  className={`text-3xl tabular-nums sm:text-5xl ${i === 0 ? "text-lime" : "text-cream"}`}
                >
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-12 border-t border-border pt-8">
            <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="text-muted">{t.proof.seenIn}</span>
              {PRESS.map((outlet) => (
                <a
                  key={outlet.name}
                  href={outlet.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cream transition-colors hover:text-lime"
                >
                  {outlet.name}
                </a>
              ))}
            </p>
          </div>
        </div>
      </section>

      <section className="border-t-[3px] border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <GithubCarousel t={t.social} />
        </div>
      </section>

      <section className="border-t-[3px] border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div className="lg:sticky lg:top-8 lg:self-start">
            <p className="text-xs tracking-widest text-muted sm:text-sm">{t.story.kicker}</p>
            <h2 className="mt-4 text-3xl leading-tight text-cream sm:text-4xl">{t.story.title}</h2>
          </div>
          <ol className="relative flex flex-col gap-8 border-l-[3px] border-border pl-8">
            {t.story.items.map((item, i) => (
              <li key={item.date} className="relative">
                <span
                  aria-hidden="true"
                  className={`absolute top-1 -left-[calc(2rem+9px)] h-4 w-4 ${
                    i === t.story.items.length - 1
                      ? "bg-lime"
                      : "border-[3px] border-border-light bg-bg"
                  }`}
                />
                <p className="text-xs tracking-widest text-muted">{item.date}</p>
                <h3 className="mt-2 text-xl text-cream sm:text-2xl">{item.title}</h3>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted normal-case">
                  {item.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t-[3px] border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-xs tracking-widest text-muted sm:text-sm">{t.play.kicker}</p>
          <h2 className="mt-4 text-3xl leading-tight text-cream sm:text-4xl">{t.play.title}</h2>
          <div className="mt-10">
            <PlayCarousel t={t.play} />
          </div>
        </div>
      </section>

      <section className="border-t-[3px] border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <BrandPreview t={t.formats} />
        </div>
      </section>

      <section className="border-t-[3px] border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-xs tracking-widest text-muted sm:text-sm">{t.sponsors.kicker}</p>
          <h2 className="mt-4 text-3xl leading-tight text-cream sm:text-4xl">{t.sponsors.title}</h2>
          <ul className="mt-10 grid grid-cols-2 border-t-[3px] border-l-[3px] border-border sm:grid-cols-3 lg:grid-cols-4">
            {SPONSORS.map((sponsor) => (
              <li
                key={sponsor.name}
                className="flex h-24 items-center justify-center border-r-[3px] border-b-[3px] border-border px-6 text-center text-sm text-warm sm:h-28 sm:text-base"
              >
                {sponsor.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small static logos, tinted with CSS
                  <img
                    src={sponsor.logo}
                    alt={sponsor.name}
                    className="max-h-8 max-w-[70%] object-contain opacity-80 brightness-0 invert sm:max-h-9"
                  />
                ) : (
                  sponsor.name
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t-[3px] border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:flex-row sm:items-center sm:gap-12 sm:px-6 sm:py-20">
          {/* eslint-disable-next-line @next/next/no-img-element -- GitHub avatar, fixed size */}
          <img
            src="https://avatars.githubusercontent.com/srizzon?s=320"
            alt={t.about.name}
            width={160}
            height={160}
            className="h-32 w-32 shrink-0 border-[3px] border-lime object-cover sm:h-40 sm:w-40"
          />
          <div className="flex max-w-2xl flex-col gap-4">
            <p className="text-xs tracking-widest text-muted sm:text-sm">{t.about.kicker}</p>
            <h2 className="text-3xl leading-tight text-cream sm:text-4xl">{t.about.name}</h2>
            <p className="text-sm leading-relaxed text-warm normal-case sm:text-base">
              {t.about.text}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {ABOUT_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lime underline decoration-2 underline-offset-4 transition-colors hover:text-cream"
                >
                  {link.name} &#8599;
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="scroll-mt-6 border-t-[3px] border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-2xl text-cream sm:text-4xl">{t.contact.title}</h2>
          <p className="mt-3 max-w-xl text-base text-cream normal-case">{t.contact.sub}</p>
          <div className="mt-8">
            <ContactForm t={t.contact} lang={lang} />
          </div>
        </div>
      </section>
    </main>
  );
}
