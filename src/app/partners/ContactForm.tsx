"use client";

import { useRef, useState, type FormEvent } from "react";
import { CONTACT_EMAIL, type Copy, type Lang } from "./copy";

type Status = "idle" | "sending" | "sent" | "error";
type Field = "name" | "email" | "company";
type Errors = Partial<Record<Field, string>>;

const FIELD_ID: Record<Field, string> = { name: "f1", email: "f2", company: "f3" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MESSAGE_MAX = 2000;

// A contact form, not a login: keep password managers and browser autofill out.
// Bitwarden, 1Password, LastPass and Dashlane each read their own attribute.
const NO_FILL = {
  "data-bwignore": "true",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-form-type": "other",
} as const;

const inputBase =
  "w-full border-[3px] bg-bg-raised px-4 py-3 font-sans text-base text-cream normal-case tracking-normal outline-none transition-colors focus-visible:border-lime";

function validate(values: Record<Field, string>, t: Copy["contact"]): Errors {
  const errors: Errors = {};
  if (!values.name) errors.name = t.errors.name;
  if (!values.email) errors.email = t.errors.emailRequired;
  else if (!EMAIL_RE.test(values.email)) errors.email = t.errors.emailInvalid;
  if (!values.company) errors.company = t.errors.company;
  return errors;
}

export default function ContactForm({ t, lang }: { t: Copy["contact"]; lang: Lang }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [messageLength, setMessageLength] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  function readValues(form: HTMLFormElement) {
    const data = new FormData(form);
    const get = (k: string) => String(data.get(k) ?? "").trim();
    return {
      name: get("f1").replace(/\s+/g, " "),
      email: get("f2").toLowerCase(),
      company: get("f3").replace(/\s+/g, " "),
      message: get("f4"),
      website: get("f5"),
    };
  }

  // After the first submit, fields re-check as the person fixes them.
  function recheck() {
    if (!submitted || !formRef.current) return;
    setErrors(validate(readValues(formRef.current), t));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const form = e.currentTarget;
    const values = readValues(form);
    const found = validate(values, t);
    setSubmitted(true);
    setErrors(found);
    const first = (Object.keys(found) as Field[])[0];
    if (first) {
      form.querySelector<HTMLInputElement>(`#partner-${FIELD_ID[first]}`)?.focus();
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/partners/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, lang }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="border-[3px] border-lime bg-bg-raised p-6" role="status" aria-live="polite">
        <p className="text-lg text-lime">{t.sentTitle}</p>
        <p className="mt-2 font-sans text-base text-cream normal-case tracking-normal">
          {t.sentText}
        </p>
      </div>
    );
  }

  const fields: { id: Field; key: string; label: string; email?: boolean; max: number }[] = [
    { id: "name", key: "f1", label: t.name, max: 100 },
    { id: "email", key: "f2", label: t.email, email: true, max: 200 },
    { id: "company", key: "f3", label: t.company, max: 200 },
  ];

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      autoComplete="off"
      {...NO_FILL}
      className="flex flex-col gap-5"
    >
      <p className="text-xs tracking-widest text-muted">
        <span className="text-lime" aria-hidden="true">
          *
        </span>{" "}
        {t.requiredNote}
      </p>
      <div className="grid gap-5 sm:grid-cols-3">
        {fields.map((f) => {
          const error = errors[f.id];
          return (
            <div key={f.id} className="flex flex-col gap-2">
              <label htmlFor={`partner-${f.key}`} className="text-xs tracking-widest text-warm">
                {f.label}{" "}
                <span className="text-lime" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id={`partner-${f.key}`}
                name={f.key}
                type="text"
                inputMode={f.email ? "email" : "text"}
                autoComplete="off"
                autoCapitalize={f.email ? "none" : "words"}
                {...NO_FILL}
                spellCheck={false}
                required
                maxLength={f.max}
                aria-required="true"
                aria-invalid={error ? "true" : undefined}
                aria-describedby={error ? `partner-${f.key}-error` : undefined}
                onChange={recheck}
                className={`${inputBase} ${error ? "border-red-400 focus-visible:border-red-400" : "border-border hover:border-border-light"}`}
              />
              {error && (
                <p
                  id={`partner-${f.key}-error`}
                  className="font-sans text-sm text-red-400 normal-case tracking-normal"
                >
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor="partner-f4" className="text-xs tracking-widest text-warm">
            {t.message} <span className="text-muted">({t.optional})</span>
          </label>
          <span id="partner-message-count" className="text-xs tabular-nums text-dim">
            {messageLength}/{MESSAGE_MAX}
          </span>
        </div>
        <textarea
          id="partner-f4"
          name="f4"
          rows={4}
          maxLength={MESSAGE_MAX}
          autoComplete="off"
          {...NO_FILL}
          aria-describedby="partner-message-count"
          onChange={(e) => setMessageLength(e.currentTarget.value.length)}
          className={`${inputBase} resize-y border-border hover:border-border-light`}
        />
      </div>

      {/* Bots fill every field; people never see this one. */}
      <div aria-hidden="true" className="hidden">
        <input name="f5" tabIndex={-1} autoComplete="off" {...NO_FILL} />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={status === "sending"}
          aria-busy={status === "sending"}
          className="btn-press bg-lime px-6 py-3 text-sm tracking-widest text-bg outline-none focus-visible:ring-[3px] focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-60 sm:text-base"
        >
          {status === "sending" ? t.sending : t.submit}
        </button>
        <div aria-live="assertive" className="min-w-0">
          {status === "error" && (
            <p role="alert" className="font-sans text-base text-cream normal-case tracking-normal">
              {t.error} <span className="select-all text-lime">{CONTACT_EMAIL}</span>
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
