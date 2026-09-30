"use client";

import { useState } from "react";
import type { OrgState } from "@/lib/towns/company-orgs";
import type { CompanyStep, OrgCheck } from "@/lib/towns/company-step";
import type { WizardCopy } from "./copy";
import { Field, GithubMark } from "./parts";

type C = WizardCopy["company"];

/** The org step: which org, and what GitHub says about you in it. */
export function OrgStep({
  c,
  login,
  orgs,
  input,
  onInput,
  onPick,
  check,
  step,
  checking,
  error,
}: {
  c: C;
  login: string;
  /** Orgs GitHub listed after the read:org sign-in. */
  orgs: OrgState[];
  input: string;
  onInput: (v: string) => void;
  onPick: (org: string) => void;
  /** The last check, only when it's for what the input says now. */
  check: OrgCheck | null;
  step: CompanyStep;
  checking: boolean;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Field label={c.orgLabel}>
        <input
          value={input}
          onChange={(e) => onInput(e.target.value)}
          placeholder={c.orgPlaceholder}
          aria-label={c.orgLabel}
          aria-describedby="org-status"
          aria-invalid={step.kind === "no_account" || step.kind === "person"}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full border-[3px] border-border bg-bg px-4 py-3 text-base text-cream normal-case outline-none placeholder:text-dim focus:border-lime"
        />
        <div id="org-status" aria-live="polite" className="mt-3">
          <OrgStatus c={c} check={check} step={step} checking={checking} input={input} error={error} />
        </div>
      </Field>

      {orgs.length > 0 && (
        <Field label={c.yourOrgs}>
          <div className="flex flex-wrap gap-2">
            {orgs.map((o) => (
              <button
                key={o.login}
                type="button"
                onClick={() => onPick(o.login)}
                className={`btn-press flex items-center gap-2 border-[3px] px-3 py-2 text-xs normal-case transition-colors ${
                  check?.org === o.login ? "border-lime text-lime" : "border-border text-cream hover:border-muted"
                }`}
              >
                <OrgAvatar url={o.avatar_url} login={o.login} size={18} />@{o.login}
              </button>
            ))}
          </div>
        </Field>
      )}

      {/* Only while we can't see you in the org yet: a verified dev has nothing to fix. */}
      {(step.kind === "none" || step.kind === "not_member" || step.kind === "github_down") && (
        <PublicGuide c={c} login={login} org={check?.org ?? null} open={step.kind === "not_member"} />
      )}
    </div>
  );
}

function OrgStatus({
  c,
  check,
  step,
  checking,
  input,
  error,
}: {
  c: C;
  check: OrgCheck | null;
  step: CompanyStep;
  checking: boolean;
  input: string;
  error: string | null;
}) {
  const bad = "text-sm leading-relaxed text-red-400 normal-case";
  const ok = "text-sm leading-relaxed text-cream normal-case";
  if (checking) return <p className="text-sm text-muted normal-case">{c.checking(input.trim().replace(/^@/, ""))}</p>;
  if (error) return <p role="alert" className={bad}>{error}</p>;
  if (!check) return <p className="text-xs text-dim normal-case">{c.orgHint}</p>;
  switch (step.kind) {
    case "no_account":
      return <p className={bad}>{c.noAccount(check.org)}</p>;
    case "person":
      return <p className={bad}>{c.person(check.org)}</p>;
    case "github_down":
      return <p className={bad}>{c.githubDown}</p>;
    case "not_member":
      return <p className={bad}>{c.notMember(check.org)}</p>;
    case "removed":
      return <p className={bad}>{c.removed(check.townLabel)}</p>;
    case "open":
      return <p className={ok}><span className="text-lime">✓</span> {c.open(check.townLabel)}</p>;
    case "move_in":
      return (
        <p className={ok}>
          <span className="text-lime">✓ {c.inOrg(check.org)}</span> {c.builtAlready(check.townLabel, check.town?.buildings ?? 0)}
        </p>
      );
    case "build":
      return (
        <p className={ok}>
          <span className="text-lime">✓ {c.inOrg(check.org)}</span> {c.notBuilt(check.townLabel)}
        </p>
      );
    default:
      return null;
  }
}

/** Before the org step: the check needs to know who you are on GitHub. */
export function SignInFirst({ c, busy, onSignIn }: { c: C; busy: boolean; onSignIn: () => void }) {
  return (
    <div className="border-[3px] border-border bg-bg-raised p-5">
      <p className="text-base text-cream">{c.signInTitle}</p>
      <p className="mt-2 text-sm text-muted normal-case">{c.signInText}</p>
      <button
        type="button"
        onClick={onSignIn}
        disabled={busy}
        className="btn-press mt-5 flex w-full items-center justify-center gap-3 bg-lime px-6 py-4 text-sm tracking-widest text-bg disabled:opacity-70"
      >
        <GithubMark />
        {c.signIn}
      </button>
    </div>
  );
}

/** The build or move-in step: the org's town and what comes with it. */
export function CompanyTownCard({ c, check, step }: { c: C; check: OrgCheck; step: CompanyStep }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 border-[3px] border-border bg-bg p-4">
        <OrgAvatar url={check.avatarUrl} login={check.org} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base text-cream normal-case">{check.townLabel}</p>
          <p className="mt-1 text-xs text-muted normal-case">@{check.org}</p>
        </div>
      </div>
      {step.kind === "build" && check.colleagues !== null && <p className="text-sm text-muted normal-case">{c.colleagues(check.colleagues)}</p>}
      {step.kind === "move_in" && check.town && (
        <dl className="flex flex-col border-[3px] border-border">
          {(
            [
              [c.buildings, String(check.town.buildings)],
              [c.whoJoins, c.membersOf(check.org)],
            ] as const
          ).map(([k, v], i) => (
            <div key={k} className={`flex items-center justify-between gap-3 px-4 py-3 text-xs ${i > 0 ? "border-t-[3px] border-border" : ""}`}>
              <dt className="text-muted">{k}</dt>
              <dd className="text-cream normal-case tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {step.kind === "move_in" && step.invited && <p className="text-sm text-muted normal-case">{c.moveInvited}</p>}
      {(step.kind === "build" || step.kind === "move_in") && step.leaving && (
        <p className="text-sm text-orange-300 normal-case">{c.leaving(step.leaving)}</p>
      )}
    </div>
  );
}

/**
 * How to make an org membership public, with a picture of the GitHub row the
 * dev will see. Folded until it's needed: it opens by itself when we can't see
 * the dev in the org.
 */
function PublicGuide({ c, login, org, open }: { c: C; login: string; org: string | null; open: boolean }) {
  const [manual, setManual] = useState(false);
  const shown = open || manual;
  const peopleUrl = org ? `https://github.com/orgs/${org}/people` : null;
  return (
    <div className={shown ? "flex flex-col gap-4 border-[3px] border-border bg-bg-card p-4 text-sm text-muted normal-case" : ""}>
      {open ? (
        <p className="text-cream">{c.guideOpen}</p>
      ) : (
        <button
          type="button"
          onClick={() => setManual((m) => !m)}
          aria-expanded={shown}
          className="flex w-full items-center justify-between text-left text-xs text-muted transition-colors hover:text-cream"
        >
          <span className="normal-case">{c.guideToggle}</span>
          <span aria-hidden>{shown ? "−" : "+"}</span>
        </button>
      )}
      {shown && (
        <>
          <ol className="flex flex-col gap-4">
            <li className="flex gap-3">
              <span className="text-lime">1</span>
              <span className="flex min-w-0 flex-col gap-1">
                <span>{c.guide1}</span>
                {peopleUrl ? (
                  <a href={peopleUrl} target="_blank" rel="noopener noreferrer" className="break-words text-cream underline underline-offset-2 hover:text-lime">
                    github.com/orgs/{org}/people ↗
                  </a>
                ) : (
                  <span className="break-words text-cream">github.com/orgs/{c.orgPlaceholder}/people</span>
                )}
              </span>
            </li>
            <li className="flex flex-col gap-2">
              <span className="flex gap-3">
                <span className="text-lime">2</span>
                <span>
                  {c.guide2a}
                  <span className="text-cream">Private</span>
                  {c.guide2b}
                  <span className="text-cream">Public</span>:
                </span>
              </span>
              <GitHubRow login={login} />
            </li>
            <li className="flex gap-3">
              <span className="text-lime">3</span>
              <span>{c.guide3}</span>
            </li>
          </ol>
          <p className="text-xs text-dim">{c.guideSafe}</p>
          {org && (
            <a href={`/api/leagues/verify?org=${encodeURIComponent(org)}`} className="self-start text-xs text-muted underline-offset-2 hover:text-cream hover:underline">
              {c.guidePrivate(org)}
            </a>
          )}
        </>
      )}
    </div>
  );
}

/** A drawing of the row on GitHub's people page, with the visibility menu open. */
function GitHubRow({ login }: { login: string }) {
  return (
    <div aria-hidden className="ml-6 border border-[#30363d] bg-[#0d1117] px-3 pt-2 pb-3 font-sans text-[12px] normal-case tracking-normal">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://github.com/${login}.png?size=40`} alt="" width={20} height={20} className="h-5 w-5 rounded-full" />
        <span className="min-w-0 flex-1 truncate text-[#4493f8]">{login}</span>
        <span className="flex shrink-0 items-center gap-1 text-[#9198a1]">
          <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden>
            <path d="M4 7V5a4 4 0 1 1 8 0v2h.5A1.5 1.5 0 0 1 14 8.5v5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5v-5A1.5 1.5 0 0 1 3.5 7H4Zm1.5 0h5V5a2.5 2.5 0 0 0-5 0v2Z" />
          </svg>
          Private ▾
        </span>
      </div>
      <div className="mt-2 ml-auto w-[80%] max-w-[220px] overflow-hidden rounded-md border border-[#3d444d] bg-[#151b23]">
        <p className="border-b border-[#3d444d] px-2 py-1 text-[11px] font-semibold text-[#f0f6fc]">Organization visibility</p>
        <p className="bg-[#1f6feb] px-2 py-1 font-semibold text-white">Public</p>
        <p className="px-2 py-1 text-[#9198a1]">✓ Private</p>
      </div>
    </div>
  );
}

export function OrgAvatar({ url, login, size }: { url: string | null; login: string; size: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- GitHub org avatar
    <img src={url} alt="" width={size} height={size} style={{ width: size, height: size }} className="shrink-0 border-[3px] border-border" />
  ) : (
    <span aria-hidden style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center border-[3px] border-border bg-bg text-xs text-lime">
      {login.slice(0, 1).toUpperCase()}
    </span>
  );
}
