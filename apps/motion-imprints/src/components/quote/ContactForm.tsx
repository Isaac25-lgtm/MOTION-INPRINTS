"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { currentSource } from "./source";

type Topic = { value: string; label: string };

type Props = {
  topics: Topic[];
  initialTopic: string;
  initialMessage: string;
  subject: string;
};

type Fields = {
  topic: string;
  name: string;
  organisation: string;
  phone: string;
  whatsappSame: boolean;
  email: string;
  location: string;
  message: string;
  consent: boolean;
  website: string;
};

/**
 * General, service, product and feedback messages. Context from the page the
 * visitor came from (service or product) is prefilled and stays editable.
 */
export function ContactForm({
  topics,
  initialTopic,
  initialMessage,
  subject,
}: Props) {
  const uid = useId();
  const [fields, setFields] = useState<Fields>({
    topic: initialTopic,
    name: "",
    organisation: "",
    phone: "",
    whatsappSame: true,
    email: "",
    location: "",
    message: initialMessage,
    consent: false,
    website: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const problemRef = useRef<HTMLDivElement>(null);
  const sentRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));
  const id = (name: string) => `${uid}-${name}`;
  const described = (name: string) =>
    errors[name]
      ? { "aria-invalid": true, "aria-describedby": id(`${name}-err`) }
      : {};
  const errorFor = (name: string) =>
    errors[name] ? (
      <p className="field__error" id={id(`${name}-err`)}>
        {errors[name]}
      </p>
    ) : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setProblem(null);
    setErrors({});
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          subject,
          source: currentSource(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201 && data.reference) {
        setSent(data.reference);
        requestAnimationFrame(() => sentRef.current?.focus());
        return;
      }
      if (res.status === 422 && data.fields) {
        setErrors(data.fields);
        setProblem("Please check the highlighted fields.");
      } else if (res.status === 503) {
        setProblem(
          "Online messages are not available right now. Please try again later.",
        );
      } else if (res.status === 429) {
        setProblem(
          "Too many messages in a short time. Please wait a few minutes.",
        );
      } else {
        setProblem(
          "Something went wrong and the message was not sent. Please try again.",
        );
      }
      requestAnimationFrame(() => problemRef.current?.focus());
    } catch {
      setProblem(
        "The connection failed and the message was not sent. Please try again.",
      );
      requestAnimationFrame(() => problemRef.current?.focus());
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="form-sent" role="status" tabIndex={-1} ref={sentRef}>
        <p className="form-sent__title">Message received.</p>
        <p>
          Your reference is <strong>{sent}</strong>. We will reply on the number
          you gave.
        </p>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={submit} noValidate>
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

      <div className="field">
        <label htmlFor={id("topic")}>What is it about?</label>
        <select
          id={id("topic")}
          value={fields.topic}
          onChange={(e) => set("topic", e.target.value)}
        >
          {topics.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor={id("message")}>Your message</label>
        <textarea
          id={id("message")}
          rows={6}
          maxLength={4000}
          required
          value={fields.message}
          onChange={(e) => set("message", e.target.value)}
          {...described("message")}
        />
        {errorFor("message")}
      </div>

      <div className="contact-form__pair">
        <div className="field">
          <label htmlFor={id("name")}>Name</label>
          <input
            id={id("name")}
            autoComplete="name"
            required
            value={fields.name}
            onChange={(e) => set("name", e.target.value)}
            {...described("name")}
          />
          {errorFor("name")}
        </div>
        <div className="field">
          <label htmlFor={id("org")}>
            Organisation <span className="field__opt">(optional)</span>
          </label>
          <input
            id={id("org")}
            autoComplete="organization"
            value={fields.organisation}
            onChange={(e) => set("organisation", e.target.value)}
          />
        </div>
      </div>

      <div className="contact-form__pair">
        <div className="field">
          <label htmlFor={id("phone")}>Phone</label>
          <input
            id={id("phone")}
            type="tel"
            autoComplete="tel"
            required
            placeholder="+256"
            value={fields.phone}
            onChange={(e) => set("phone", e.target.value)}
            {...described("phone")}
          />
          {errorFor("phone")}
        </div>
        <div className="field">
          <label htmlFor={id("email")}>
            Email <span className="field__opt">(optional)</span>
          </label>
          <input
            id={id("email")}
            type="email"
            autoComplete="email"
            value={fields.email}
            onChange={(e) => set("email", e.target.value)}
            {...described("email")}
          />
          {errorFor("email")}
        </div>
      </div>

      <div className="field field--check">
        <input
          id={id("wa")}
          type="checkbox"
          checked={fields.whatsappSame}
          onChange={(e) => set("whatsappSame", e.target.checked)}
        />
        <label htmlFor={id("wa")}>This number is on WhatsApp</label>
      </div>

      <div className="field">
        <label htmlFor={id("loc")}>
          Town or area <span className="field__opt">(optional)</span>
        </label>
        <input
          id={id("loc")}
          autoComplete="address-level2"
          value={fields.location}
          onChange={(e) => set("location", e.target.value)}
        />
      </div>

      {/* Honeypot: hidden from people and assistive technology. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor={id("website")}>Website</label>
        <input
          id={id("website")}
          tabIndex={-1}
          autoComplete="off"
          value={fields.website}
          onChange={(e) => set("website", e.target.value)}
        />
      </div>

      <div className="field field--check">
        <input
          id={id("consent")}
          type="checkbox"
          checked={fields.consent}
          onChange={(e) => set("consent", e.target.checked)}
          {...described("consent")}
        />
        <label htmlFor={id("consent")}>
          Motion Imprints may contact me about this message by phone, WhatsApp
          or email.
        </label>
      </div>
      {errorFor("consent")}

      <button className="btn btn--solid" type="submit" disabled={sending}>
        {sending ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
