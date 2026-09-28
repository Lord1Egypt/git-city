"use client";

import { EMAIL_TODOS } from "@/lib/email/todos";
import { Badge } from "./ui";

export type DueState = "done" | "overdue" | "soon" | "later";

export function dueState(due: string, done?: string): DueState {
  if (done) return "done";
  const days = (Date.parse(`${due}T23:59:59Z`) - Date.now()) / 86_400_000;
  if (days < 0) return "overdue";
  if (days <= 7) return "soon";
  return "later";
}

function dueLabel(due: string, state: DueState): string {
  const date = new Date(`${due}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const days = Math.ceil((Date.parse(`${due}T23:59:59Z`) - Date.now()) / 86_400_000);
  if (state === "overdue") return `${date} · ${-days}d late`;
  if (state === "soon") return days <= 0 ? `${date} · today` : `${date} · in ${days}d`;
  return date;
}

const TONE = { done: "lime", overdue: "red", soon: "yellow", later: "muted" } as const;

export function TodosTab() {
  const items = [...EMAIL_TODOS].sort((a, b) => Number(!!a.done) - Number(!!b.done) || a.due.localeCompare(b.due));
  return (
    <div className="space-y-3">
      {items.map((t) => {
        const state = dueState(t.due, t.done);
        return (
          <div key={t.id} className={`border bg-bg-raised p-4 ${state === "overdue" ? "border-red-800/40" : state === "soon" ? "border-yellow-600/30" : "border-border"} ${state === "done" ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className={`text-xs ${state === "done" ? "text-muted line-through" : "text-cream"}`}>{t.title}</h3>
              <Badge tone={TONE[state]}>{state === "done" ? `done ${t.done}` : dueLabel(t.due, state)}</Badge>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">{t.why}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-dim"><span className="text-muted">How:</span> {t.how}</p>
          </div>
        );
      })}
      <p className="pt-2 text-[10px] text-dim">These live in src/lib/email/todos.ts. Mark one done by setting its done date.</p>
    </div>
  );
}
