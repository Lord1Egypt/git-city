import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { COPY, langFromAcceptLanguage, type Copy } from "./copy";
import { getExampleTown, type ExampleTown } from "./example";

export const dynamic = "force-dynamic";

async function getCopy(): Promise<Copy> {
  const h = await headers();
  return COPY[langFromAcceptLanguage(h.get("accept-language"))];
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getCopy();
  return {
    title: t.meta.title,
    description: t.meta.description,
    openGraph: { title: t.meta.title, description: t.meta.description, siteName: "Git City", type: "website" },
  };
}

// /communities: why a community leader puts their community in Git City. The
// promise up top, a real community town with its leader, then what the leader
// and the members each do, every step shown with that town's real pieces.
export default async function CommunitiesPage() {
  const [t, town] = await Promise.all([getCopy(), getExampleTown()]);
  return (
    <main className="min-h-screen bg-bg pb-24 font-pixel uppercase text-warm">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="text-sm text-muted transition-colors hover:text-cream">
          &larr; {t.back}
        </Link>
        <span className="text-xs tracking-widest text-muted">{t.label}</span>
      </nav>

      <section className="border-t-[3px] border-border">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-8 text-center sm:px-6 sm:pt-12">
          <p className="text-xs tracking-widest text-muted sm:text-sm">{t.kicker}</p>
          <h1 className="mt-4 text-3xl leading-tight text-cream sm:text-5xl">
            {t.title}
            <br />
            <span className="text-lime">{t.accent}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-cream normal-case sm:text-lg">{t.sub}</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <CreateButton t={t} />
            {town && (
              <Link
                href={`/town/${town.slug}`}
                className="btn-press border-[3px] border-border px-5 py-2.5 text-sm tracking-widest text-muted transition-colors hover:text-cream sm:text-base"
              >
                {t.see}
              </Link>
            )}
          </div>
        </div>

        {town && <TownWindow t={t} town={town} />}
      </section>

      {town && <Roles t={t} town={town} />}

      <section className="mx-auto mt-16 max-w-4xl px-4 sm:px-6">
        <div className="flex flex-col gap-6 border-[3px] border-border bg-bg-raised p-5 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="max-w-xl">
            <h2 className="text-xl text-lime sm:text-2xl">{t.brandsTitle}</h2>
            <p className="mt-3 text-sm leading-relaxed text-cream normal-case sm:text-base">{t.brandsText}</p>
          </div>
          <div className="shrink-0">
            <CreateButton t={t} />
          </div>
        </div>
      </section>
    </main>
  );
}

function CreateButton({ t }: { t: Copy }) {
  return (
    <Link href="/towns/new?for=community" className="btn-press inline-block bg-lime px-6 py-3 text-sm tracking-widest text-bg sm:text-base">
      {t.cta}
    </Link>
  );
}

function Face({ login, src, size = 32 }: { login: string; src: string | null; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- GitHub avatar, fixed size
    <img
      src={src ?? `https://github.com/${login}.png?size=80`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 border-[3px] border-bg-card bg-bg-raised"
      style={{ width: size, height: size }}
    />
  );
}

/** The example town in its window, its leader this week on the bar. */
function TownWindow({ t, town }: { t: Copy; town: ExampleTown }) {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6">
      <article className="border-[3px] border-border bg-bg-card">
        <div className="relative aspect-[4/3] overflow-hidden border-b-[3px] border-border bg-bg-raised sm:aspect-[2/1]">
          {town.cover && (
            // eslint-disable-next-line @next/next/no-img-element -- the town's cover photo
            <img src={town.cover} alt={town.name} className="absolute inset-0 h-full w-full object-cover" />
          )}
        </div>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="truncate text-2xl leading-none text-cream sm:text-3xl">{town.name}</p>
            {town.buildings != null && (
              <p className="mt-2 text-xs text-muted sm:text-sm">
                {town.buildings} {t.members}
              </p>
            )}
          </div>
          {town.leader && (
            <div className="flex min-w-0 items-center gap-3 sm:justify-end">
              <Face login={town.leader.login} src={town.leader.avatar} size={40} />
              <div className="min-w-0 sm:text-right">
                <p className="truncate text-sm text-cream normal-case sm:text-base">@{town.leader.login}</p>
                <p className="mt-1 text-xs text-muted">
                  {t.leads} · <span className="text-lime tabular-nums">{town.leader.total}</span> {t.contributions}
                </p>
              </div>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

function Step({ n, text, lime = false, children }: { n: number; text: string; lime?: boolean; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-3 border-t-[3px] border-border py-4 first:border-t-0 first:pt-5 last:pb-0">
      <p className="flex gap-3 text-sm normal-case">
        <span className="shrink-0 text-muted tabular-nums">0{n}</span>
        <span className={lime ? "text-lime" : "text-cream"}>{text}</span>
      </p>
      {children && <div className="min-w-0 pl-8">{children}</div>}
    </li>
  );
}

/** What the leader does and what the members do, each step with the example town's real piece. */
function Roles({ t, town }: { t: Copy; town: ExampleTown }) {
  const today = (new Date().getUTCDay() + 6) % 7;
  const days = town.rank?.days ?? [];
  const max = Math.max(1, ...days);
  return (
    <section className="mx-auto mt-16 grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-3 px-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-6 sm:px-6">
      <div className="flex min-w-0 flex-col border-[3px] border-border bg-bg-card p-5 sm:p-6">
        <h2 className="text-xs tracking-widest text-muted">{t.youTitle}</h2>
        <ol className="mt-1">
          <Step n={1} text={t.youSteps[0]}>
            <div className="flex items-center gap-3">
              {town.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- the town's logo
                <img src={town.logoUrl} alt="" width={40} height={40} className="h-10 w-10 border-[3px] border-border bg-bg object-contain" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center border-[3px] border-border bg-bg text-lime">{town.name[0]}</span>
              )}
              <span className="truncate text-sm text-cream">{town.name}</span>
            </div>
          </Step>
          <Step n={2} text={t.youSteps[1]}>
            <p className="truncate border-[3px] border-border bg-bg px-3 py-2 text-xs text-cream normal-case">
              thegitcity.com/town/{town.slug}
            </p>
          </Step>
          <Step n={3} text={t.youSteps[2]}>
            {town.rank && (
              <p className="text-xs text-lime tabular-nums">
                {t.place(town.rank.rank)} · {Math.round(town.rank.perDev)} {t.perDev}
              </p>
            )}
          </Step>
        </ol>
      </div>

      <div className="flex min-w-0 flex-col border-[3px] border-lime bg-bg-card p-5 sm:p-6">
        <h2 className="text-xs tracking-widest text-lime">{t.themTitle}</h2>
        <ol className="mt-1">
          <Step n={1} text={t.themSteps[0]}>
            <div className="flex items-center">
              <div className="flex -space-x-2">
                {town.faces.map((f) => (
                  <Face key={f.login} login={f.login} src={f.avatar} />
                ))}
              </div>
              {town.moreFaces > 0 && <span className="ml-3 text-xs text-muted tabular-nums">+{town.moreFaces}</span>}
            </div>
          </Step>
          <Step n={2} text={t.themSteps[1]}>
            <div className="flex gap-1.5" aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => (
                <span
                  key={i}
                  className="h-5 w-5 border-[3px] border-border"
                  style={
                    i > today
                      ? undefined
                      : { background: `color-mix(in oklch, var(--color-lime) ${Math.round(15 + ((days[i] ?? 0) / max) * 85)}%, var(--color-bg-card))` }
                  }
                />
              ))}
            </div>
          </Step>
          <Step n={3} text={t.themSteps[2]} lime>
            {town.leader && (
              <div className="flex items-center gap-3">
                <Face login={town.leader.login} src={town.leader.avatar} />
                <span className="truncate text-xs text-cream normal-case">@{town.leader.login}</span>
              </div>
            )}
          </Step>
        </ol>
      </div>
    </section>
  );
}
