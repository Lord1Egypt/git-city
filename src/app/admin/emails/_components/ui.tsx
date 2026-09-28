"use client";

import { useCallback, useState } from "react";

export function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 10_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString("en-US");
}

export function pct(part: number, whole: number, digits = 1): string {
  if (!whole) return "–";
  return `${((part / whole) * 100).toFixed(digits)}%`;
}

export function ButtonGroup<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`cursor-pointer border px-3 py-1.5 text-[11px] transition-colors ${
            value === opt.value ? "relative z-10 border-lime bg-lime/10 text-lime" : "border-border text-muted hover:text-cream"
          } ${i > 0 ? "-ml-px" : ""}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

type Tone = "lime" | "yellow" | "red" | "muted" | "blue";

const TONES: Record<Tone, string> = {
  lime: "bg-lime/15 text-lime border-lime/30",
  yellow: "bg-yellow-900/20 text-yellow-400 border-yellow-600/30",
  red: "bg-red-900/20 text-red-400 border-red-800/30",
  muted: "bg-bg text-muted border-border",
  blue: "bg-sky-900/20 text-sky-300 border-sky-700/30",
};

export function Badge({ tone = "muted", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-block whitespace-nowrap border px-2 py-0.5 text-[10px] ${TONES[tone]}`}>{children}</span>;
}

export function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "lime" | "red" | "yellow" }) {
  const color = tone === "lime" ? "text-lime" : tone === "red" ? "text-red-400" : tone === "yellow" ? "text-yellow-400" : "text-cream";
  return (
    <div className="border border-border bg-bg-raised p-4">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`mt-1 text-2xl tabular-nums ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-dim">{sub}</p>}
    </div>
  );
}

export function Button({ children, onClick, variant = "ghost", disabled, title }: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  title?: string;
}) {
  const styles = {
    primary: "border-lime bg-lime text-bg hover:bg-lime/90",
    ghost: "border-border text-cream hover:border-lime/50 hover:text-lime",
    danger: "border-red-800/50 text-red-400 hover:bg-red-900/20",
  }[variant];
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled} className={`cursor-pointer border px-3 py-1.5 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles}`}>
      {children}
    </button>
  );
}

export interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  return { toasts, push, dismiss };
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed right-4 top-4 z-100 flex flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-center gap-3 border px-4 py-3 text-xs shadow-lg ${t.type === "success" ? "border-lime/30 bg-lime/10 text-lime" : "border-red-800/30 bg-red-900/20 text-red-400"}`}>
          <span>{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="cursor-pointer opacity-60 hover:opacity-100" aria-label="Dismiss">x</button>
        </div>
      ))}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <h2 className="text-[11px] uppercase tracking-wider text-dim">{children}</h2>
      {right}
    </div>
  );
}
