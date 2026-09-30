"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { LayoutNorms } from "@/lib/github";
import { createBrowserSupabase } from "@/lib/supabase";
import { signInWithGitHub } from "@/lib/sign-in";
import { COMPANY_TEMPLATE, isTemplateId, type TemplateId } from "@/lib/league-city/templates";
import { LOGO_MAX_BYTES } from "@/lib/league-city/identity";
import type { CityObject } from "@/lib/league-city/types";
import type { LeagueCity } from "@/lib/league-city/service";
import type { OrgState } from "@/lib/towns/company-orgs";
import { companyStep, normalizeOrgInput, type OrgCheck } from "@/lib/towns/company-step";
import { COPY, type Lang, type Purpose, type WizardCopy } from "./copy";
import { CityPreview, CopyBlock, CopyRow, Field, GithubMark, LogoTile, MiniMap } from "./parts";
import { CompanyTownCard, OrgStep, SignInFirst } from "./company";

// Create a town as a short tutorial (Discord's "create a server": who it's
// for, name and icon, then the invite link right away): the town takes shape
// live on the right while the left walks through what to do, and it ends by
// handing over the link to share and the editor to build with. Company towns
// swap the name for a GitHub org check: one town per org, and an org's town
// that already exists is moved into, not built.

type StepId = "purpose" | "org" | "name" | "template" | "create" | "share" | "build";
type Join = "open" | "request";
/** Communities and friends share the name, message and join copy. */
type Social = Exclude<Purpose, "company">;

const TEMPLATE_ORDER: TemplateId[] = ["crew", "park", "hq", "race", "blank"];
/** What the wizard keeps across the GitHub sign-in round trip. */
const DRAFT_KEY = "gc:new-town-draft";
const PIXEL = 32;
/** How long the org input waits after the last key before checking. */
const CHECK_DELAY_MS = 600;

interface Draft {
  purpose: Social;
  name: string;
  template: TemplateId;
  join: Join;
  /** The picked image as a data URL, uploaded once the town exists. */
  logo: string | null;
}

export interface WizardViewer {
  id: number;
  login: string;
  claimed: boolean;
}

function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    if (d.purpose !== "community" && d.purpose !== "friends") return null;
    return {
      purpose: d.purpose,
      name: typeof d.name === "string" ? d.name.slice(0, 40) : "",
      template: isTemplateId(d.template) ? d.template : "crew",
      join: d.join === "request" ? "request" : "open",
      logo: typeof d.logo === "string" && d.logo.startsWith("data:image/") ? d.logo : null,
    };
  } catch {
    return null;
  }
}

function writeDraft(d: Draft | null) {
  try {
    if (d) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Private mode or full storage: the draft just doesn't survive the sign-in.
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** A 32px center crop, close to what the server's pixelize makes of it. */
async function pixelPreview(src: string): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = PIXEL;
  c.height = PIXEL;
  const ctx = c.getContext("2d");
  if (!ctx) return src;
  const s = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, PIXEL, PIXEL);
  return c.toDataURL("image/png");
}

function signIn(back: string) {
  void signInWithGitHub(createBrowserSupabase(), `${window.location.origin}/auth/callback?next=${encodeURIComponent(back)}`);
}

export default function CreateWizard({
  lang,
  viewer,
  cityDevs,
  cityNorms,
  startPurpose,
  startTemplate,
  startName,
  resume,
  orgs,
  startOrg,
  startCheck,
  verifyFailed,
}: {
  lang: Lang;
  viewer: WizardViewer | null;
  cityDevs: Record<string, unknown>[];
  cityNorms: LayoutNorms;
  startPurpose: Purpose | null;
  startTemplate: TemplateId | null;
  startName: string | null;
  /** Back from GitHub sign-in: restore the draft and finish creating. */
  resume: boolean;
  /** Orgs the viewer verified on GitHub, with their towns. */
  orgs: OrgState[];
  startOrg: string | null;
  /** The server's check of `startOrg`, so the org step opens already knowing. */
  startCheck: OrgCheck | null;
  verifyFailed: boolean;
}) {
  const t = COPY[lang];
  const c = t.company;
  const [purpose, setPurpose] = useState<Purpose | null>(startPurpose);
  const p: Purpose = purpose ?? "community";
  const social: Social = p === "company" ? "community" : p;
  const company = p === "company";

  const [name, setName] = useState(startName ?? "");
  const [template, setTemplate] = useState<TemplateId>(startTemplate ?? (startPurpose === "company" ? COMPANY_TEMPLATE : "crew"));
  const [join, setJoin] = useState<Join>("open");
  const [logo, setLogo] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Company: the org being looked at and what the server found out about it.
  const [orgInput, setOrgInput] = useState(startCheck?.org ?? startOrg ?? "");
  const [lastCheck, setCheck] = useState<OrgCheck | null>(startCheck);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(verifyFailed ? c.verifyFailed : null);
  // A check only counts while the input still names its org.
  const check = company && lastCheck && lastCheck.org === normalizeOrgInput(orgInput) ? lastCheck : null;
  const orgStep = companyStep(check);
  const existing = check?.account === "org" && check.town ? check.town : null;

  const steps: StepId[] = [
    ...(startPurpose ? [] : (["purpose"] as StepId[])),
    ...(company
      ? orgStep.kind === "move_in"
        ? (["org", "create"] as StepId[])
        : (["org", "template", "create", "share", "build"] as StepId[])
      : (["name", "template", "create", "share", "build"] as StepId[])),
  ];
  const [stepId, setStepId] = useState<StepId>(steps[0]);
  const index = Math.max(0, steps.indexOf(stepId));
  const goNext = () => setStepId(steps[Math.min(steps.length - 1, index + 1)]);
  const goBack = () => setStepId(steps[Math.max(0, index - 1)]);

  const shownName = company
    ? check && orgStep.kind !== "no_account" && orgStep.kind !== "person"
      ? check.townLabel
      : c.anyName
    : name.trim() || (purpose ? t.namePlaceholder[social] : t.anyName);
  const previewLogo = company ? (check?.avatarUrl ?? null) : logoPreview;
  const link = slug ? `https://thegitcity.com/town/${slug}` : "";

  // An org's town that already exists: the preview shows its real streets.
  const [real, setReal] = useState<{ slug: string; h: number; objects: CityObject[] } | null>(null);
  useEffect(() => {
    if (!existing) return;
    let stop = false;
    fetch(`/api/leagues/${existing.slug}/city`)
      .then((r) => (r.ok ? (r.json() as Promise<LeagueCity>) : null))
      .then((city) => {
        if (city && !stop) setReal({ slug: existing.slug, h: city.h, objects: city.objects.filter((o) => o.kind === "item") });
      })
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [existing]);
  const realCity = existing && real?.slug === existing.slug ? real : null;

  // ── Company: checking the org ──────────────────────────────
  // Only the newest check may land: an older answer can arrive after it.
  const checkSeq = useRef(0);
  async function runCheck(raw?: string): Promise<OrgCheck | null> {
    const org = normalizeOrgInput(raw ?? orgInput);
    if (!org) {
      setCheckError((raw ?? orgInput).trim() ? c.badName : c.typeOrg);
      return null;
    }
    const seq = ++checkSeq.current;
    setChecking(true);
    setCheckError(null);
    try {
      const res = await fetch(`/api/leagues/verify/check?org=${encodeURIComponent(org)}`, { cache: "no-store" });
      const json = (await res.json()) as OrgCheck & { error?: string };
      if (seq !== checkSeq.current) return null;
      if (!res.ok) {
        setCheckError(json.error ?? c.checkError);
        return null;
      }
      setCheck(json);
      // The address follows the org, so a reload or a shared link lands here again.
      window.history.replaceState(null, "", `/towns/new?kind=company&org=${encodeURIComponent(json.org)}`);
      return json;
    } catch {
      if (seq === checkSeq.current) setCheckError(t.networkError);
      return null;
    } finally {
      if (seq === checkSeq.current) setChecking(false);
    }
  }

  // Checks the org once you stop typing, like a username field.
  const typedOrg = company && viewer && stepId === "org" ? normalizeOrgInput(orgInput) : null;
  useEffect(() => {
    if (!typedOrg || lastCheck?.org === typedOrg) return;
    const id = setTimeout(() => void runCheck(typedOrg), CHECK_DELAY_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runCheck reads the latest state
  }, [typedOrg, lastCheck?.org]);

  function orgContinue() {
    if (orgStep.kind === "open") {
      setBusy(true);
      window.location.href = `/town/${orgStep.slug}`;
      return;
    }
    if (orgStep.kind === "build" || orgStep.kind === "move_in") {
      goNext();
      return;
    }
    void runCheck();
  }

  async function companyCreate() {
    if (!check) return;
    const expect = orgStep.kind === "build" ? "create" : "join";
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leagues/verify/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org: check.org, expect, template }),
      });
      const json = (await res.json().catch(() => ({}))) as { slug?: string; error?: string; code?: string };
      if (!res.ok || !json.slug) {
        setBusy(false);
        // The town changed since the check (someone built it first, or the
        // membership went private): look again from the org step.
        if (json.code === "town_exists" || json.code === "no_town" || json.code === "not_member") {
          setStepId("org");
          const fresh = await runCheck(check.org);
          if (fresh && json.code !== "not_member") setCheckError(c.changed);
          return;
        }
        setError(json.error ?? t.createError);
        return;
      }
      if (expect === "join") {
        window.location.href = `/town/${json.slug}`;
        return;
      }
      setSlug(json.slug);
      setStepId("share");
    } catch {
      setError(t.networkError);
    }
    setBusy(false);
  }

  // ── Communities and friends: creating the town ─────────────
  async function pickLogo(file: File | null) {
    setLogoError(false);
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > LOGO_MAX_BYTES) {
      setLogoError(true);
      return;
    }
    try {
      const src = await readAsDataUrl(file);
      setLogo(src);
      setLogoPreview(await pixelPreview(src));
    } catch {
      setLogoError(true);
    }
  }

  async function create(draft: Draft) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name.trim(), template: draft.template, join: draft.join }),
      });
      const json = (await res.json().catch(() => ({}))) as { league?: { slug: string }; error?: string };
      if (!res.ok || !json.league) {
        setError(json.error ?? t.createError);
        setBusy(false);
        return;
      }
      const newSlug = json.league.slug;
      if (draft.logo) {
        try {
          const blob = await (await fetch(draft.logo)).blob();
          const form = new FormData();
          form.append("file", new File([blob], "logo", { type: blob.type }));
          const up = await fetch(`/api/leagues/${newSlug}/logo`, { method: "POST", body: form });
          if (!up.ok) setWarning(t.logoError);
        } catch {
          setWarning(t.logoError);
        }
      }
      writeDraft(null);
      setSlug(newSlug);
      setStepId("share");
    } catch {
      setError(t.networkError);
    }
    setBusy(false);
  }

  function onCreate() {
    if (company) {
      void companyCreate();
      return;
    }
    const draft: Draft = { purpose: social, name, template, join, logo };
    if (!viewer) {
      setBusy(true);
      writeDraft(draft);
      signIn(`/towns/new?for=${social}&resume=1`);
      return;
    }
    void create(draft);
  }

  // Back from GitHub: put the draft back, drop ?resume and finish the create, once.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !resume) return;
    resumed.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("resume");
    history.replaceState(null, "", url);
    const d = readDraft();
    if (!d) return;
    setPurpose(d.purpose);
    setName(d.name);
    setTemplate(d.template);
    setJoin(d.join);
    if (d.logo) {
      setLogo(d.logo);
      void pixelPreview(d.logo).then(setLogoPreview).catch(() => {});
    }
    setStepId("create");
    if (viewer?.claimed) void create(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on the way back
  }, [resume]);

  function choosePurpose(k: Purpose) {
    setPurpose(k);
    if (k === "company") setTemplate(COMPANY_TEMPLATE);
    setStepId(k === "company" ? "org" : "name");
  }

  const head = headFor(t, stepId, p, social, check);
  const created = slug !== null;
  const claimBlocked = !!viewer && !viewer.claimed;
  const orgLabel =
    orgStep.kind === "open" && check
      ? c.openTown(check.townLabel)
      : orgStep.kind === "not_member"
        ? c.checkAgain
        : orgStep.kind === "github_down"
          ? c.tryAgain
          : t.next;
  const createLabel = company
    ? orgStep.kind === "move_in"
      ? c.moveCta(check?.townLabel ?? "")
      : c.buildCta(check?.townLabel ?? "")
    : viewer
      ? t.createCta
      : t.createSignIn;
  const backHref = p === "community" && startPurpose === "community" ? "/communities" : "/towns";

  return (
    <main className="min-h-screen bg-bg pb-24 font-pixel uppercase text-warm">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href={backHref} className="text-sm text-muted transition-colors hover:text-cream">
          &larr; {backHref === "/communities" ? (lang === "pt" ? "Comunidades" : "Communities") : t.back}
        </Link>
      </nav>
      <div className="border-t-[3px] border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 lg:pt-16">
          <div className="order-2 min-w-0 lg:order-1">
            <div className="flex gap-1.5" aria-hidden="true">
              {steps.map((s, i) => (
                <span key={s} className={`h-2 flex-1 ${i <= index ? "bg-lime" : "bg-border"}`} />
              ))}
            </div>
            <p className="mt-4 text-xs tracking-widest text-muted">
              {t.stepOf(index + 1, steps.length)} · {t.labels[stepId]}
            </p>
            <h1 className="mt-3 text-2xl leading-tight text-cream sm:text-4xl">{head.title}</h1>
            <p className="mt-4 text-sm leading-relaxed text-muted normal-case sm:text-base">{head.sub}</p>

            <div className="mt-8">
              {stepId === "purpose" && <PurposeStep t={t} onPick={choosePurpose} />}

              {stepId === "org" &&
                (viewer ? (
                  <OrgStep
                    c={c}
                    login={viewer.login}
                    orgs={orgs}
                    input={orgInput}
                    onInput={(v) => {
                      setOrgInput(v);
                      setCheckError(null);
                    }}
                    onPick={(org) => {
                      setOrgInput(org);
                      void runCheck(org);
                    }}
                    check={check}
                    step={orgStep}
                    checking={checking}
                    error={checkError}
                  />
                ) : (
                  <SignInFirst
                    c={c}
                    busy={busy}
                    onSignIn={() => {
                      setBusy(true);
                      signIn("/towns/new?kind=company");
                    }}
                  />
                ))}

              {stepId === "name" && (
                <div className="flex flex-col gap-6">
                  <Field label={t.nameLabel[social]}>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value.slice(0, 40))}
                      onKeyDown={(e) => e.key === "Enter" && name.trim().length >= 2 && goNext()}
                      placeholder={t.namePlaceholder[social]}
                      autoFocus
                      autoComplete="off"
                      spellCheck={false}
                      aria-label={t.nameLabel[social]}
                      className="w-full border-[3px] border-border bg-bg px-4 py-3 text-base text-cream normal-case outline-none placeholder:text-dim focus:border-lime"
                    />
                  </Field>
                  <Field label={t.logoLabel} hint={logoError ? undefined : t.logoHint}>
                    <div className="flex items-center gap-4">
                      <LogoTile src={logoPreview} name={shownName} size={56} />
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="btn-press border-[3px] border-border px-4 py-2.5 text-xs tracking-widest text-cream hover:border-lime"
                      >
                        {logo ? t.logoChange : t.logoPick}
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={(e) => void pickLogo(e.target.files?.[0] ?? null)}
                      />
                    </div>
                    {logoError && (
                      <p role="alert" className="mt-2 text-xs text-red-400 normal-case">
                        {t.logoBad}
                      </p>
                    )}
                  </Field>
                </div>
              )}

              {stepId === "template" && (
                <div role="radiogroup" aria-label={t.labels.template} className="flex flex-col gap-2">
                  {TEMPLATE_ORDER.map((id) => {
                    const on = template === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setTemplate(id)}
                        className="btn-press flex items-center gap-4 border-[3px] bg-bg p-3 text-left"
                        style={{ borderColor: on ? "var(--color-lime)" : "var(--color-border)" }}
                      >
                        <MiniMap id={id} on={on} />
                        <span className="min-w-0">
                          <span className={`block text-sm ${on ? "text-lime" : "text-cream"}`}>{t.templates[id].name}</span>
                          <span className="mt-1 block text-xs text-muted normal-case">{t.templates[id].blurb}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {stepId === "create" && (
                <div className="flex flex-col gap-6">
                  {company ? (
                    check && <CompanyTownCard c={c} check={check} step={orgStep} />
                  ) : (
                    <Field label={t.joinLabel}>
                      <JoinChoice t={t} purpose={social} join={join} onChange={setJoin} disabled={busy} />
                    </Field>
                  )}
                  {claimBlocked ? (
                    <div className="border-[3px] border-border bg-bg-raised p-4">
                      <p className="text-sm text-cream normal-case">{t.claimFirst}</p>
                      <Link href="/" className="btn-press mt-4 inline-block bg-lime px-5 py-2.5 text-xs tracking-widest text-bg">
                        {t.claimCta}
                      </Link>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={onCreate}
                      disabled={busy}
                      className="btn-press flex w-full items-center justify-center gap-3 bg-lime px-6 py-4 text-sm tracking-widest text-bg disabled:opacity-70 sm:text-base"
                    >
                      {!viewer && <GithubMark />}
                      {busy ? (company && orgStep.kind === "move_in" ? c.moving : t.creating) : createLabel}
                    </button>
                  )}
                  {error && (
                    <p role="alert" className="text-sm text-red-400 normal-case">
                      {error}
                    </p>
                  )}
                </div>
              )}

              {stepId === "share" && created && (
                <div className="flex flex-col gap-6">
                  {warning && <p className="border-[3px] border-border bg-bg-raised p-3 text-xs text-cream normal-case">{warning}</p>}
                  <Field label={t.linkLabel}>
                    <CopyRow text={link} shown={link.replace("https://", "")} copy={t.copy} copied={t.copied} />
                  </Field>
                  <Field label={t.messageLabel}>
                    <CopyBlock
                      text={company && check ? c.message(check.townLabel, check.org, link) : t.message[social](shownName, link)}
                      lang={lang}
                      copy={t.copyMessage}
                      copied={t.copied}
                    />
                  </Field>
                  <div className="border-[3px] border-border bg-bg-raised p-4">
                    <p className="text-sm text-lime">{t.mondayTitle}</p>
                    <p className="mt-2 text-sm text-cream normal-case">{t.mondayText}</p>
                  </div>
                </div>
              )}

              {stepId === "build" && (
                <ul className="flex flex-col border-[3px] border-border bg-bg">
                  {t.tools.map((x) => (
                    <li key={x.k} className="flex gap-4 border-t-[3px] border-border p-4 first:border-t-0">
                      <span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 bg-lime" />
                      <span className="min-w-0">
                        <span className="block text-sm text-cream">{x.k}</span>
                        <span className="mt-1 block text-xs text-muted normal-case">{x.v}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              {(index > 0 && !created && !busy) || stepId === "build" ? (
                <button type="button" onClick={goBack} className="btn-press px-2 py-3 text-xs tracking-widest text-muted hover:text-cream">
                  &larr; {t.backStep}
                </button>
              ) : (
                <span />
              )}
              {stepId === "build" && slug ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/town/${slug}?new=1`} className="btn-press border-[3px] border-border px-5 py-2.5 text-sm tracking-widest text-muted hover:text-cream">
                    {t.enter}
                  </Link>
                  <Link href={`/town/${slug}?new=1&edit=1`} className="btn-press bg-lime px-6 py-3 text-sm tracking-widest text-bg">
                    {t.openEditor}&nbsp; &rarr;
                  </Link>
                </div>
              ) : stepId === "org" && viewer ? (
                <button
                  type="button"
                  onClick={orgContinue}
                  disabled={busy || checking || orgStep.kind === "removed" || !orgInput.trim()}
                  className="btn-press bg-lime px-6 py-3 text-sm tracking-widest text-bg disabled:opacity-40"
                >
                  {orgLabel}
                </button>
              ) : stepId === "name" || stepId === "template" || stepId === "share" ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={stepId === "name" && name.trim().length < 2}
                  className="btn-press bg-lime px-6 py-3 text-sm tracking-widest text-bg disabled:opacity-40"
                >
                  {t.next}
                </button>
              ) : null}
            </div>
          </div>

          <div className="order-1 min-w-0 lg:sticky lg:top-8 lg:order-2 lg:self-start">
            <CityPreview
              template={template}
              name={shownName}
              logo={previewLogo}
              viewerId={viewer?.id ?? null}
              cityDevs={cityDevs}
              cityNorms={cityNorms}
              real={realCity}
              caption={realCity && existing ? `${existing.buildings} ${c.buildings}` : `${t.templates[template].name} · 1 ${t.member}`}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function headFor(t: WizardCopy, step: StepId, p: Purpose, social: Social, check: OrgCheck | null): { title: string; sub: string } {
  const c = t.company;
  switch (step) {
    case "purpose":
      return { title: t.purposeTitle, sub: t.purposeSub };
    case "org":
      return { title: c.orgTitle, sub: c.orgSub };
    case "name":
      return { title: t.nameTitle[social], sub: t.nameSub };
    case "template":
      return { title: t.templateTitle, sub: t.templateSub };
    case "create":
      if (p === "company" && check) {
        return check.town ? { title: c.moveTitle(check.townLabel), sub: c.moveSub } : { title: c.buildTitle(check.townLabel), sub: c.buildSub };
      }
      return { title: t.createTitle, sub: t.createSub };
    case "share":
      return p === "company" ? { title: c.shareTitle, sub: c.shareSub } : { title: t.shareTitle[social], sub: t.shareSub[social] };
    case "build":
      return { title: t.buildTitle, sub: t.buildSub };
  }
}

function PurposeStep({ t, onPick }: { t: WizardCopy; onPick: (k: Purpose) => void }) {
  const opts: Purpose[] = ["community", "friends", "company"];
  return (
    <div className="flex flex-col gap-3">
      {opts.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onPick(k)}
          className="btn-press group flex items-center justify-between gap-4 border-[3px] border-border bg-bg p-4 text-left hover:border-lime sm:p-5"
        >
          <span className="min-w-0">
            <span className="block text-base text-cream group-hover:text-lime">{t.purposes[k].title}</span>
            <span className="mt-2 block text-sm text-muted normal-case">{t.purposes[k].text}</span>
          </span>
          <span aria-hidden="true" className="shrink-0 text-muted group-hover:text-lime">
            &rarr;
          </span>
        </button>
      ))}
    </div>
  );
}

function JoinChoice({
  t,
  purpose,
  join,
  onChange,
  disabled,
}: {
  t: WizardCopy;
  purpose: Social;
  join: Join;
  onChange: (j: Join) => void;
  disabled: boolean;
}) {
  const opts: { id: Join; title: string; text: string; tag?: string }[] = [
    { id: "open", title: t.openTitle, text: t.openText, tag: t.recommended[purpose] },
    { id: "request", title: t.askTitle, text: t.askText },
  ];
  return (
    <div role="radiogroup" aria-label={t.joinLabel} className="flex flex-col gap-3">
      {opts.map((o) => {
        const on = join === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className="btn-press flex items-start gap-4 border-[3px] bg-bg p-4 text-left sm:p-5"
            style={{ borderColor: on ? "var(--color-lime)" : "var(--color-border)" }}
          >
            <span className={`mt-1 h-4 w-4 shrink-0 border-[3px] ${on ? "border-lime bg-lime" : "border-border-light"}`} />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-base text-cream">{o.title}</span>
                {o.tag && <span className="bg-lime px-2 py-0.5 text-[10px] text-bg">{o.tag}</span>}
              </span>
              <span className="mt-2 block text-sm text-muted normal-case">{o.text}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
