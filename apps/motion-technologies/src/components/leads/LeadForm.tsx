"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { currentSource } from "./source";

type Option = { value: string; label: string };

type Props = {
  solutions: Option[];
  initialSolution: string;
  initialType: string;
};

type Fields = {
  solution: string;
  requestType: string;
  timeline: string;
  name: string;
  organisation: string;
  role: string;
  phone: string;
  whatsappSame: boolean;
  whatsapp: string;
  email: string;
  location: string;
  message: string;
  consent: boolean;
  website: string;
};

const requestTypes: Option[] = [
  { value: "discuss", label: "Discuss a project" },
  { value: "demo", label: "See a demonstration" },
  { value: "quote", label: "Request a quotation" },
];

const timelines: Option[] = [
  { value: "", label: "Not sure yet" },
  { value: "exploring", label: "Just exploring" },
  { value: "within-3-months", label: "Within 3 months" },
  { value: "3-6-months", label: "In 3 to 6 months" },
  { value: "later", label: "Later than that" },
];

/**
 * Technologies lead form. The solution the visitor came from is preselected
 * and stays editable. Contact details live in component state only.
 */
export function LeadForm({ solutions, initialSolution, initialType }: Props) {
  const router = useRouter();
  const uid = useId();
  const [f, setF] = useState<Fields>({
    solution: initialSolution,
    requestType: initialType,
    timeline: "",
    name: "",
    organisation: "",
    role: "",
    phone: "",
    whatsappSame: true,
    whatsapp: "",
    email: "",
    location: "",
    message: "",
    consent: false,
    website: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const problemRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));
  const id = (n: string) => `${uid}-${n}`;
  const invalid = (n: string) =>
    errors[n]
      ? { "aria-invalid": true, "aria-describedby": id(`${n}-err`) }
      : {};
  const err = (n: string) =>
    errors[n] ? (
      <p className="field__error" id={id(`${n}-err`)}>
        {errors[n]}
      </p>
    ) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setProblem(null);
    setErrors({});
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, source: currentSource() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201 && data.reference) {
        router.push(`/contact/sent?ref=${encodeURIComponent(data.reference)}`);
        return;
      }
      if (res.status === 422 && data.fields) {
        setErrors(data.fields);
        setProblem("Please check the highlighted fields.");
      } else if (res.status === 503) {
        setProblem(
          "Online inquiries are not available right now. Please try again later.",
        );
      } else if (res.status === 429) {
        setProblem(
          "Too many requests in a short time. Please wait a few minutes.",
        );
      } else {
        setProblem(
          "Something went wrong and nothing was sent. Please try again.",
        );
      }
    } catch {
      setProblem(
        "The connection failed and nothing was sent. Please try again.",
      );
    } finally {
      setSending(false);
      requestAnimationFrame(() => problemRef.current?.focus());
    }
  }

  return (
    <form className="lead-form" onSubmit={submit} noValidate>
      {problem ? (
        <div
          className="form-problem"
          role="alert"
          tabIndex={-1}
          ref={problemRef}
        >
          <p>{problem}</p>
        </div>
      ) : null}

      <fieldset className="lead-form__group">
        <legend>What would you like?</legend>
        <div className="choice-row">
          {requestTypes.map((t) => (
            <label key={t.value} className="choice">
              <input
                type="radio"
                name="requestType"
                value={t.value}
                checked={f.requestType === t.value}
                onChange={() => set("requestType", t.value)}
              />
              <span>{t.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="lead-form__pair">
        <div className="field">
          <label htmlFor={id("solution")}>Area</label>
          <select
            id={id("solution")}
            value={f.solution}
            onChange={(e) => set("solution", e.target.value)}
          >
            <option value="general">Not sure yet / something else</option>
            {solutions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={id("timeline")}>When would you like to start?</label>
          <select
            id={id("timeline")}
            value={f.timeline}
            onChange={(e) => set("timeline", e.target.value)}
          >
            {timelines.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor={id("message")}>
          The work the system should support
        </label>
        <textarea
          id={id("message")}
          rows={5}
          maxLength={4000}
          value={f.message}
          aria-describedby={id("message-hint")}
          onChange={(e) => set("message", e.target.value)}
          {...invalid("message")}
        />
        <p className="field__hint" id={id("message-hint")}>
          What you do today, what gets in the way, and roughly how many people
          would use it. Please do not include patient, member or student
          records.
        </p>
        {err("message")}
      </div>

      <div className="lead-form__pair">
        <div className="field">
          <label htmlFor={id("name")}>Name</label>
          <input
            id={id("name")}
            autoComplete="name"
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
            {...invalid("name")}
          />
          {err("name")}
        </div>
        <div className="field">
          <label htmlFor={id("org")}>Organisation</label>
          <input
            id={id("org")}
            autoComplete="organization"
            value={f.organisation}
            onChange={(e) => set("organisation", e.target.value)}
            {...invalid("organisation")}
          />
          {err("organisation")}
        </div>
      </div>

      <div className="lead-form__pair">
        <div className="field">
          <label htmlFor={id("phone")}>Phone</label>
          <input
            id={id("phone")}
            type="tel"
            autoComplete="tel"
            placeholder="+256"
            value={f.phone}
            onChange={(e) => set("phone", e.target.value)}
            {...invalid("phone")}
          />
          {err("phone")}
        </div>
        <div className="field">
          <label htmlFor={id("email")}>
            Email <span className="field__opt">(optional)</span>
          </label>
          <input
            id={id("email")}
            type="email"
            autoComplete="email"
            value={f.email}
            onChange={(e) => set("email", e.target.value)}
            {...invalid("email")}
          />
          {err("email")}
        </div>
      </div>

      <div className="field field--check">
        <input
          id={id("wa")}
          type="checkbox"
          checked={f.whatsappSame}
          onChange={(e) => set("whatsappSame", e.target.checked)}
        />
        <label htmlFor={id("wa")}>This number is on WhatsApp</label>
      </div>

      <div className="lead-form__pair">
        <div className="field">
          <label htmlFor={id("role")}>
            Your role <span className="field__opt">(optional)</span>
          </label>
          <input
            id={id("role")}
            autoComplete="organization-title"
            value={f.role}
            onChange={(e) => set("role", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={id("loc")}>
            Town or district <span className="field__opt">(optional)</span>
          </label>
          <input
            id={id("loc")}
            autoComplete="address-level2"
            value={f.location}
            onChange={(e) => set("location", e.target.value)}
          />
        </div>
      </div>

      <div className="hp" aria-hidden="true">
        <label htmlFor={id("website")}>Website</label>
        <input
          id={id("website")}
          tabIndex={-1}
          autoComplete="off"
          value={f.website}
          onChange={(e) => set("website", e.target.value)}
        />
      </div>

      <div className="field field--check">
        <input
          id={id("consent")}
          type="checkbox"
          checked={f.consent}
          onChange={(e) => set("consent", e.target.checked)}
          {...invalid("consent")}
        />
        <label htmlFor={id("consent")}>
          Motion Imprints Technologies may contact me about this inquiry.
        </label>
      </div>
      {err("consent")}

      <button className="btn btn--dark" type="submit" disabled={sending}>
        {sending ? "Sending…" : "Send Inquiry"}
      </button>
    </form>
  );
}
