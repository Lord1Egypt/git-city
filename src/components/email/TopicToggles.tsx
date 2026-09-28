"use client";

import { EMAIL_TOPICS, TOPIC_GROUP_LABELS, type TopicGroup } from "@/lib/email/topics";

export function Toggle({ checked, onChange, label, sublabel, disabled }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center justify-between cursor-pointer group ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <div>
        <span className="text-sm text-cream normal-case">{label}</span>
        {sublabel && <p className="text-xs text-muted normal-case mt-0.5">{sublabel}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative h-6 w-11 shrink-0 border-[3px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8e64a]/50 ${
          checked ? "border-[#c8e64a] bg-[#c8e64a]/10" : "border-border bg-transparent"
        }`}
      >
        <span
          className={`block h-3 w-3 transition-all absolute top-[3px] ${
            checked ? "left-[22px]" : "left-[3px]"
          }`}
          style={{ backgroundColor: checked ? "#c8e64a" : "var(--color-muted)" }}
        />
      </button>
    </label>
  );
}

/**
 * The email topics grouped as Game / Jobs / From Git City, shared by the
 * settings page and the no-login preference page.
 */
export function TopicToggles({ values, onChange, disabled, hidden = [] }: {
  values: Record<string, unknown>;
  onChange: (key: string, value: boolean) => void;
  disabled?: boolean;
  hidden?: string[];
}) {
  const groups: TopicGroup[] = ["game", "jobs", "news"];
  return (
    <>
      {groups.map((group) => {
        const topics = EMAIL_TOPICS.filter((t) => t.group === group && !hidden.includes(t.key));
        if (topics.length === 0) return null;
        return (
          <div key={group} className="border-[3px] border-border bg-bg-raised p-6 sm:p-8 mb-6">
            <h2 className="text-sm text-cream mb-5">{TOPIC_GROUP_LABELS[group]}</h2>
            <div className="space-y-5">
              {topics.map((t) => (
                <Toggle
                  key={t.key}
                  checked={typeof values[t.key] === "boolean" ? (values[t.key] as boolean) : t.defaultOn}
                  onChange={(v) => onChange(t.key, v)}
                  label={t.label}
                  sublabel={t.description}
                  disabled={disabled}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
