import type { Metadata } from "next";
import { headers } from "next/headers";
import { getViewer } from "@/lib/leagues/service";
import { getCityNorms, getLeagueCityDevs, type LeagueMemberRow } from "@/lib/leagues/queries";
import { isTemplateId } from "@/lib/league-city/templates";
import { loadOrgStates } from "@/lib/towns/company-orgs";
import { checkCompanyOrg } from "@/lib/towns/company-check";
import { normalizeOrgInput } from "@/lib/towns/company-step";
import { langFromAcceptLanguage } from "@/app/partners/copy";
import CreateWizard from "./wizard/CreateWizard";
import type { Purpose } from "./wizard/copy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New town - Git City",
  description: "Create a town for your community, your friends or your company in Git City.",
  robots: { index: false, follow: false },
};

type Search = { template?: string; name?: string; kind?: string; org?: string; error?: string; for?: string; resume?: string };

export default async function NewTownPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { template, name, kind, org, error, for: forParam, resume } = await searchParams;
  const [viewer, h] = await Promise.all([getViewer(), headers()]);
  // ?kind=company is the old Company tab's address (org links, GitHub's way back).
  const purpose: Purpose | null =
    kind === "company" || forParam === "company" ? "company" : forParam === "community" || forParam === "friends" ? forParam : null;

  // The preview shows your own building on its lot.
  const me: LeagueMemberRow | null = viewer
    ? {
        developer_id: viewer.id,
        login: viewer.github_login,
        name: null,
        avatar_url: null,
        status: "active",
        verification: null,
        contributions: 0,
        joined_at: null,
        invited_by: null,
      }
    : null;
  // A colleague's link (or the way back from GitHub) names the org: check it
  // here so the org step opens already knowing. Read-only, like every check.
  const startOrg = typeof org === "string" ? normalizeOrgInput(org) : null;
  const [cityDevs, cityNorms, orgs, startCheck] = await Promise.all([
    me ? getLeagueCityDevs([me]).catch(() => []) : Promise.resolve([]),
    getCityNorms(),
    viewer ? loadOrgStates(viewer.id).catch(() => []) : Promise.resolve([]),
    viewer && startOrg && purpose === "company" ? checkCompanyOrg(viewer, startOrg).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <CreateWizard
      lang={langFromAcceptLanguage(h.get("accept-language"))}
      viewer={viewer ? { id: viewer.id, login: viewer.github_login, claimed: viewer.claimed } : null}
      cityDevs={cityDevs}
      cityNorms={cityNorms}
      startPurpose={purpose}
      startTemplate={isTemplateId(template) ? template : null}
      startName={typeof name === "string" ? name.slice(0, 40) : null}
      resume={resume === "1"}
      orgs={orgs}
      startOrg={startOrg}
      startCheck={startCheck}
      verifyFailed={!!error}
    />
  );
}
