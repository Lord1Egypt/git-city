import Link from "next/link";
import type { RankedTown } from "@/lib/towns/discover";
import { DAILY_CONTRIBUTION_CAP, TOWN_MIN_CODERS } from "@/lib/leagues/scoring";
import { townDisplayName } from "@/lib/towns/names";

// This week's race between towns: the one rule, then the table. The first
// town on Sunday night takes the monument in the center of Git City.
export default function WeekRanking({ towns }: { towns: RankedTown[] }) {
  return (
    <section id="this-week" className="mt-10 scroll-mt-6">
      <h2 className="text-xl text-cream sm:text-2xl">This week</h2>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted normal-case">
        The town that codes the most this week gets the monument in the center of Git City. Score: average GitHub contributions of
        members who coded, max {DAILY_CONTRIBUTION_CAP}/day, {TOWN_MIN_CODERS}+ coding to rank.
      </p>
      {towns.length === 0 ? (
        <p className="mt-4 border-[3px] border-border bg-bg-card px-4 py-3 text-xs text-muted normal-case">
          No town has {TOWN_MIN_CODERS} members coding yet this week.{" "}
          <Link href="/towns/new" className="text-lime hover:text-cream">
            Create a town
          </Link>
        </p>
      ) : (
        <ol className="mt-4 space-y-1.5">
          {towns.map((t) => (
            <li key={t.league_id}>
              <Link
                href={`/town/${t.slug}`}
                className={`flex items-center gap-3 border-[3px] bg-bg-card px-3 py-2 transition-colors hover:border-muted ${t.rank === 1 ? "border-lime" : "border-border"}`}
              >
                <span className={`w-6 shrink-0 text-right text-xs tabular-nums ${t.rank === 1 ? "text-lime" : "text-muted"}`}>{t.rank}</span>
                {t.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.logoUrl} alt="" width={24} height={24} className="h-6 w-6 shrink-0 [image-rendering:pixelated]" />
                ) : (
                  <span className="h-6 w-6 shrink-0 border-2 border-border" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate text-xs text-cream normal-case">{townDisplayName(t.name)}</span>
                <span className="shrink-0 text-xs text-cream tabular-nums">
                  {t.per_dev.toLocaleString("en-US")} <span className="text-muted">per dev</span>
                </span>
                <span className="w-20 shrink-0 text-right text-[10px] text-muted tabular-nums max-sm:hidden">{t.coding} coding</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
