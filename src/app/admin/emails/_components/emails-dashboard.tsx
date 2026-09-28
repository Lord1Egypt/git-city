"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailsOverview } from "@/app/api/admin/emails/route";
import { EMAIL_CATALOG } from "@/lib/email/catalog";
import { EMAIL_TODOS } from "@/lib/email/todos";
import { ButtonGroup, Toasts, useToasts } from "./ui";
import { OverviewTab } from "./overview-tab";
import { CatalogTab } from "./catalog-tab";
import { CampaignsTab } from "./campaigns-tab";
import { TodosTab, dueState } from "./todos-tab";

type Tab = "overview" | "emails" | "campaigns" | "todo";
type Period = "7" | "30";

export function EmailsDashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (params.get("tab") as Tab) || "overview";
  const [period, setPeriod] = useState<Period>("30");
  const [overview, setOverview] = useState<EmailsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toasts, push, dismiss } = useToasts();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/emails?days=${period}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      setOverview(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const setTab = (next: Tab) => {
    const url = new URLSearchParams(params.toString());
    if (next === "overview") url.delete("tab");
    else url.set("tab", next);
    router.replace(`/admin/emails${url.size ? `?${url}` : ""}`, { scroll: false });
  };

  const dueCount = EMAIL_TODOS.filter((t) => !t.done && ["overdue", "soon"].includes(dueState(t.due))).length;
  const tabs: { key: Tab; label: string; count?: number; alert?: boolean }[] = [
    { key: "overview", label: "Overview" },
    { key: "emails", label: "Emails", count: EMAIL_CATALOG.length },
    { key: "campaigns", label: "Campaigns" },
    { key: "todo", label: "To-do", count: dueCount || undefined, alert: dueCount > 0 },
  ];

  return (
    <div className="min-h-screen bg-bg p-4 sm:p-6 lg:p-8">
      {loading && (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-border">
          <div className="h-full w-1/3 bg-lime" style={{ animation: "emails-loading 1s ease-in-out infinite" }} />
          <style>{`@keyframes emails-loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`}</style>
        </div>
      )}
      <Toasts toasts={toasts} onDismiss={dismiss} />

      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] text-dim">
              <Link href="/admin" className="hover:text-cream">Admin</Link> / Emails
            </p>
            <h1 className="mt-2 text-2xl text-cream">EMAILS</h1>
            <p className="mt-1 text-xs text-muted">Delivery health, every email we send, campaigns and dated chores</p>
          </div>
          {(tab === "overview" || tab === "emails") && (
            <div className="flex items-center gap-2">
              <ButtonGroup options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }]} value={period} onChange={setPeriod} />
              <button onClick={load} className="cursor-pointer border border-border px-3 py-1.5 text-[11px] text-muted hover:text-cream">Refresh</button>
            </div>
          )}
        </div>

        <nav className="mb-6 flex gap-6 overflow-x-auto border-b border-border" aria-label="Sections">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`-mb-px flex cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 pb-3 text-xs transition-colors ${
                tab === t.key ? "border-lime text-lime" : "border-transparent text-muted hover:text-cream"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={`px-1.5 py-0.5 text-[10px] ${t.alert ? "bg-yellow-900/30 text-yellow-400" : "bg-bg-raised text-dim"}`}>{t.count}</span>
              )}
            </button>
          ))}
        </nav>

        {error && <div className="mb-6 border border-red-800/30 bg-red-900/20 px-4 py-3 text-xs text-red-400">{error}</div>}

        {tab === "overview" && <OverviewTab overview={overview} />}
        {tab === "emails" && <CatalogTab overview={overview} onToast={push} />}
        {tab === "campaigns" && <CampaignsTab onToast={push} />}
        {tab === "todo" && <TodosTab />}
      </div>
    </div>
  );
}
