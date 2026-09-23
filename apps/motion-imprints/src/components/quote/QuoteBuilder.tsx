"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { MAX_LINE_NOTES, type CartLine } from "@/lib/quote/cart";
import { currentSource } from "./source";
import { quoteList, useQuoteList } from "./store";

type Channels = { phone: string; whatsapp: string; email: string };

type Fields = {
  name: string;
  organisation: string;
  phone: string;
  whatsappSame: boolean;
  whatsapp: string;
  email: string;
  location: string;
  deadline: string;
  notes: string;
  consent: boolean;
  website: string;
};

const initial: Fields = {
  name: "",
  organisation: "",
  phone: "",
  whatsappSame: true,
  whatsapp: "",
  email: "",
  location: "",
  deadline: "",
  notes: "",
  consent: false,
  website: "",
};

const noop = () => () => {};

function Line({ line, onRemoved }: { line: CartLine; onRemoved: () => void }) {
  const uid = useId();
  const options = Object.entries(line.options);
  return (
    <li className="quote-line">
      <div className="quote-line__head">
        <h3>
          <Link href={`/products/${line.slug}`}>{line.title}</Link>
        </h3>
        <button
          type="button"
          className="linkbutton"
          onClick={() => {
            quoteList.remove(line.id);
            onRemoved();
          }}
        >
          Remove<span className="visually-hidden"> {line.title}</span>
        </button>
      </div>
      {options.length ? (
        <ul className="quote-line__options">
          {options.map(([k, v]) => (
            <li key={k}>{v}</li>
          ))}
        </ul>
      ) : null}
      <div className="quote-line__fields">
        <div className="field field--short">
          <label htmlFor={`${uid}-q`}>Quantity ({line.unit})</label>
          <input
            id={`${uid}-q`}
            type="number"
            inputMode="numeric"
            min={1}
            max={100000}
            value={line.quantity}
            onChange={(e) =>
              quoteList.update(line.id, { quantity: Number(e.target.value) })
            }
          />
        </div>
        <div className="field">
          <label htmlFor={`${uid}-n`}>Notes</label>
          <textarea
            id={`${uid}-n`}
            rows={2}
            maxLength={MAX_LINE_NOTES}
            value={line.notes}
            onChange={(e) =>
              quoteList.update(line.id, { notes: e.target.value })
            }
          />
        </div>
      </div>
    </li>
  );
}

export function QuoteBuilder({ channels }: { channels: Channels }) {
  const router = useRouter();
  const uid = useId();
  const lines = useQuoteList();
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [fields, setFields] = useState<Fields>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const problemRef = useRef<HTMLDivElement>(null);

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
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          items: lines.map((l) => ({
            slug: l.slug,
            options: l.options,
            quantity: l.quantity,
            notes: l.notes,
          })),
          source: currentSource(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201 && data.reference) {
        quoteList.clear();
        router.push(`/quote/sent?ref=${encodeURIComponent(data.reference)}`);
        return;
      }
      if (res.status === 422 && data.fields) {
        setErrors(data.fields);
        setProblem("Please check the highlighted fields.");
      } else if (res.status === 503) {
        setProblem(
          "Online requests are not available right now. Your list is still saved on this device.",
        );
      } else if (res.status === 429) {
        setProblem(
          "Too many requests in a short time. Please wait a few minutes and try again.",
        );
      } else {
        setProblem(
          "Something went wrong and the request was not sent. Your list is still saved; please try again.",
        );
      }
    } catch {
      setProblem(
        "The connection failed and the request was not sent. Your list is still saved; please try again.",
      );
    } finally {
      setSending(false);
      requestAnimationFrame(() => problemRef.current?.focus());
    }
  }

  if (!hydrated) {
    return <p className="quote-loading">Loading your quote list…</p>;
  }

  if (lines.length === 0) {
    return (
      <div className="quote-empty">
        <p className="quote-empty__title">Your quote list is empty.</p>
        <p>
          Add products with the options you need, or describe a custom job in a
          message.
        </p>
        <div className="actions">
          <Link className="btn btn--solid" href="/products">
            Browse Products
          </Link>
          <Link className="btn btn--ghost" href="/contact">
            Send a Message
          </Link>
        </div>
        <p className="visually-hidden" role="status">
          {announce}
        </p>
      </div>
    );
  }

  const itemErrors = Object.entries(errors).filter(([k]) =>
    k.startsWith("items"),
  );
  const direct = channels.phone || channels.whatsapp || channels.email;

  return (
    <div className="quote-builder">
      <section className="quote-builder__list" aria-labelledby="list-h">
        <div className="quote-builder__head">
          <h2 id="list-h">
            Your list{" "}
            <span className="quote-builder__count">
              {lines.length} {lines.length === 1 ? "item" : "items"}
            </span>
          </h2>
          {confirmClear ? (
            <span className="quote-builder__confirm">
              Clear every item?{" "}
              <button
                type="button"
                className="linkbutton"
                onClick={() => {
                  quoteList.clear();
                  setConfirmClear(false);
                  setAnnounce("Your quote list was cleared.");
                }}
              >
                Yes, clear
              </button>{" "}
              <button
                type="button"
                className="linkbutton"
                onClick={() => setConfirmClear(false)}
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="linkbutton"
              onClick={() => setConfirmClear(true)}
            >
              Clear list
            </button>
          )}
        </div>
        <ul className="quote-lines">
          {lines.map((line) => (
            <Line
              key={line.id}
              line={line}
              onRemoved={() => setAnnounce(`${line.title} removed.`)}
            />
          ))}
        </ul>
        {itemErrors.length ? (
          <ul className="field__error">
            {itemErrors.map(([k, v]) => (
              <li key={k}>{v}</li>
            ))}
          </ul>
        ) : null}
        <Link className="textlink" href="/products">
          Add more products <span aria-hidden="true">→</span>
        </Link>
        <p className="visually-hidden" role="status">
          {announce}
        </p>
      </section>

      <form
        className="quote-form"
        onSubmit={submit}
        noValidate
        aria-labelledby="details-h"
      >
        <h2 id="details-h">Your details</h2>
        <p className="quote-form__intro">
          We use these only to reply about this request. Nothing is stored in
          your browser.
        </p>

        {problem ? (
          <div
            className="form-problem"
            role="alert"
            tabIndex={-1}
            ref={problemRef}
          >
            <p>{problem}</p>
            {direct && !Object.keys(errors).length ? (
              <p>
                You can also reach us directly:{" "}
                {channels.phone ? (
                  <a href={`tel:${channels.phone.replace(/[^\d+]/g, "")}`}>
                    {channels.phone}
                  </a>
                ) : null}
                {channels.phone && channels.email ? " · " : null}
                {channels.email ? (
                  <a href={`mailto:${channels.email}`}>{channels.email}</a>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}

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
        <div className="field field--check">
          <input
            id={id("wa-same")}
            type="checkbox"
            checked={fields.whatsappSame}
            onChange={(e) => set("whatsappSame", e.target.checked)}
          />
          <label htmlFor={id("wa-same")}>This number is on WhatsApp</label>
        </div>
        {!fields.whatsappSame ? (
          <div className="field">
            <label htmlFor={id("wa")}>
              WhatsApp number <span className="field__opt">(optional)</span>
            </label>
            <input
              id={id("wa")}
              type="tel"
              value={fields.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
              {...described("whatsapp")}
            />
            {errorFor("whatsapp")}
          </div>
        ) : null}
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
        <div className="field">
          <label htmlFor={id("loc")}>Town or area</label>
          <input
            id={id("loc")}
            autoComplete="address-level2"
            required
            value={fields.location}
            onChange={(e) => set("location", e.target.value)}
            {...described("location")}
          />
          {errorFor("location")}
        </div>
        <div className="field field--short">
          <label htmlFor={id("date")}>
            Needed by <span className="field__opt">(optional)</span>
          </label>
          <input
            id={id("date")}
            type="date"
            value={fields.deadline}
            onChange={(e) => set("deadline", e.target.value)}
            {...described("deadline")}
          />
          {errorFor("deadline")}
        </div>
        <div className="field">
          <label htmlFor={id("notes")}>
            Anything else <span className="field__opt">(optional)</span>
          </label>
          <textarea
            id={id("notes")}
            rows={4}
            maxLength={2000}
            value={fields.notes}
            onChange={(e) => set("notes", e.target.value)}
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
            Motion Imprints may contact me about this request by phone, WhatsApp
            or email.
          </label>
        </div>
        {errorFor("consent")}

        <button
          className="btn btn--solid quote-form__submit"
          type="submit"
          disabled={sending}
        >
          {sending ? "Sending…" : "Send Quote Request"}
        </button>
        <p className="quote-form__small">
          No payment is taken. We reply with a quotation or any questions.
        </p>
      </form>
    </div>
  );
}
