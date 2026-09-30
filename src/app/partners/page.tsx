import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { COPY, langFromAcceptLanguage, type Copy, type Lang } from "./copy";
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
    openGraph: { title: t.meta.title, description: t.meta.description, siteName: "Git City", type: "website" },
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
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-cream normal-case sm:text-lg">{t.hero.sub}</p>
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
