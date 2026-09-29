import type { Metadata } from "next";
import Link from "next/link";

const TITLE = "Media Kit - Git City";
const DESCRIPTION = "Your GitHub as a 3D city. 50,900 developers signed in with GitHub.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: "Git City", type: "website" },
};

// Figures as of Sep 2026. Update the label and the numbers together.
const AS_OF = "Sep 2026";

const STATS: { value: string; label: string; hi?: boolean }[] = [
  { value: "50,900", label: "signed in with GitHub", hi: true },
  { value: "87,600", label: "developers in the city" },
  { value: "5,800", label: "GitHub stars" },
  { value: "291", label: "forks, open source" },
  { value: "117,500", label: "visitors in launch month" },
  { value: "5 min", label: "average session" },
  { value: "34%", label: "on GitHub for 5+ years" },
  { value: "$0", label: "paid marketing" },
];

const INSIDE = [
  { title: "The city", text: "87,600 GitHub profiles as buildings" },
  { title: "Towns", text: "Dev communities compete on commits every week" },
  { title: "Drive", text: "Race, drift and smash rival buildings" },
];

const TOWNS: { name: string; color?: string }[] = [
  { name: "Claude", color: "#d97757" },
  { name: "Codex", color: "#6b8cff" },
  { name: "FullDev" },
  { name: "Brasil" },
  { name: "India" },
  { name: "USA" },
  { name: "Vibe Coders" },
];

const COUNTRIES = ["Brazil", "India", "USA"];
const LANGUAGES = ["JavaScript", "TypeScript", "Python"];

const GITHUB_POSTS = [
  { name: "X", href: "https://x.com/github/status/2048494014383505661" },
  { name: "YouTube", href: "https://www.youtube.com/shorts/34nTbYNWm4c" },
  { name: "TikTok", href: "https://www.tiktok.com/@github/video/7633192200859340064" },
  { name: "Instagram", href: "https://www.instagram.com/reel/DXn0azYFOnW/" },
];

const PRESS = [
  { name: "The Next Web", href: "https://thenextweb.com/news/inside-the-mind-of-a-viral-indie-hacker" },
  {
    name: "Tecmundo",
    href: "https://www.tecmundo.com.br/mercado/413306-playbook-como-construir-uma-comunidade-de-80-mil-desenvolvedores-em-60-dias.htm",
  },
  { name: "WebGPU", href: "https://www.webgpu.com/showcase/git-city-github-3d-pixel-skyline/" },
];

const SPONSORS = [
  "Firecrawl",
  "NodeOps",
  "Colosseum",
  "Context.dev",
  "Kodus",
  "AbacatePay",
  "Himetrica",
  "Acelera Dev",
  "UltraContext",
  "Guara Cloud",
  "Viral Day",
  "Git Trophy",
];

const CONTACT = "samuel@thegitcity.com";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm tracking-widest text-cream sm:text-base">{children}</h2>;
}

export default function MediaKitPage() {
  return (
    <main className="min-h-screen bg-bg pb-24 font-pixel uppercase text-warm">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="text-sm text-muted transition-colors hover:text-cream">
          &larr; City
        </Link>
        <span className="text-xs tracking-widest text-muted">Media kit · {AS_OF}</span>
      </nav>

      <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 sm:px-6">
        <header className="border-t-[3px] border-border pt-10">
          <h1 className="text-4xl leading-tight text-cream sm:text-6xl">
            Your GitHub
            <br />
            as a <span className="text-lime">3D city</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-cream normal-case sm:text-lg">
            Every developer is a building. Height is commits, windows are recent activity.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- live share card from our own route */}
          <img
            src="/api/share-card/srizzon"
            alt="A developer's Git City card with their building, level and GitHub stats"
            width={1200}
            height={675}
            className="mt-8 block h-auto w-full border-[3px] border-border"
          />
        </header>

        <section className="flex flex-col gap-5 border-t-[3px] border-border pt-8">
          <SectionTitle>What&apos;s inside</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            {INSIDE.map((item) => (
              <div key={item.title} className="flex flex-col gap-3 border-[3px] border-border bg-bg-raised p-5">
                <span className="text-sm text-lime sm:text-base">{item.title}</span>
                <p className="text-sm leading-relaxed text-cream normal-case">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {TOWNS.map((town) => (
              <span
                key={town.name}
                className="border-[3px] border-border bg-bg-raised px-3 py-2 text-xs text-cream"
                style={town.color ? { borderColor: town.color } : undefined}
              >
                {town.name}
              </span>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-5 border-t-[3px] border-border pt-8">
          <SectionTitle>Real developers</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-2 border-[3px] border-border bg-bg-raised p-4 sm:p-5">
                <span className={`text-2xl tabular-nums sm:text-3xl ${stat.hi ? "text-lime" : "text-cream"}`}>
                  {stat.value}
                </span>
                <span className="text-xs text-muted normal-case sm:text-sm">{stat.label}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { title: "Top countries", items: COUNTRIES },
              { title: "Top languages", items: LANGUAGES },
            ].map((list) => (
              <div key={list.title}>
                <p className="text-xs tracking-widest text-muted">{list.title}</p>
                <ol className="mt-3 flex flex-col">
                  {list.items.map((item, i) => (
                    <li key={item} className="flex gap-4 border-b border-border py-2.5 text-base text-cream sm:text-lg">
                      <span className="w-5 text-lime">{i + 1}</span>
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-5 border-t-[3px] border-border pt-8">
          <SectionTitle>Featured by</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-[3fr_1fr]">
            <div className="flex flex-col gap-3 border-[3px] border-lime bg-bg-raised p-5">
              <span className="text-xs tracking-widest text-muted">Shared by GitHub</span>
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-base text-lime sm:text-lg">
                {GITHUB_POSTS.map((post) => (
                  <a
                    key={post.name}
                    href={post.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-2 underline-offset-4 hover:text-cream"
                  >
                    {post.name}
                  </a>
                ))}
              </p>
              <span className="text-xs text-muted normal-case sm:text-sm">2.7M followers on X</span>
            </div>
            <div className="flex flex-col gap-2 border-[3px] border-border bg-bg-raised p-5">
              <span className="text-2xl text-lime sm:text-3xl">1.4M+</span>
              <span className="text-xs text-muted normal-case sm:text-sm">views on creator videos</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {PRESS.map((outlet) => (
              <a
                key={outlet.name}
                href={outlet.href}
                target="_blank"
                rel="noopener noreferrer"
                className="border-[3px] border-border px-4 py-4 text-center text-sm text-warm transition-colors hover:border-border-light hover:text-cream"
              >
                {outlet.name} &#8599;
              </a>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-5 border-t-[3px] border-border pt-8">
          <SectionTitle>Previous sponsors</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SPONSORS.map((name) => (
              <span
                key={name}
                className="flex h-16 items-center justify-center border-[3px] border-border bg-bg-raised px-2 text-center text-xs text-cream sm:text-sm"
              >
                {name}
              </span>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t-[3px] border-border pt-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3">
            <SectionTitle>Contact</SectionTitle>
            <a href={`mailto:${CONTACT}`} className="text-base text-lime hover:text-cream sm:text-lg">
              {CONTACT}
            </a>
          </div>
          <Link href="/" className="text-sm text-muted transition-colors hover:text-cream">
            thegitcity.com
          </Link>
        </section>
      </div>
    </main>
  );
}
