"use client";

import Link from "next/link";
import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

type Turn = { role: "user" | "assistant"; content: string };

type Props = {
  /** Whether a model provider is configured on the server. */
  available: boolean;
  subtitle: string;
  suggestions: string[];
  /** Site paths the assistant may mention; they become links. */
  linkPrefixes: string[];
  whatsappHref?: string;
};

/** Turn known site paths in a reply into links; everything else stays text. */
function renderReply(text: string, prefixes: string[]): ReactNode[] {
  const pattern = new RegExp(
    `(${prefixes.map((p) => p.replace(/[/\\-]/g, "\\$&")).join("|")})(?:/[a-z0-9-]+)*`,
    "g",
  );
  return text.split("\n").map((line, i) => {
    const parts: ReactNode[] = [];
    let last = 0;
    for (const m of line.matchAll(pattern)) {
      parts.push(line.slice(last, m.index));
      parts.push(
        <Link key={`${i}-${m.index}`} href={m[0]}>
          {m[0]}
        </Link>,
      );
      last = (m.index ?? 0) + m[0].length;
    }
    parts.push(line.slice(last));
    return (
      <Fragment key={i}>
        {i > 0 ? <br /> : null}
        {parts}
      </Fragment>
    );
  });
}

/**
 * "Ask Motion": a small, grounded sales assistant with a human handoff.
 * The conversation lives only in this component's state; nothing is stored
 * in the browser or on the server.
 */
export function Assistant({
  available,
  subtitle,
  suggestions,
  linkPrefixes,
  whatsappHref,
}: Props) {
  const uid = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<"chat" | "handoff" | "done">(
    available ? "chat" : "handoff",
  );
  const [handoff, setHandoff] = useState({
    name: "",
    phone: "",
    email: "",
    summary: "",
    consent: false,
    website: "",
  });
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [turns, busy]);

  function show() {
    dialogRef.current?.showModal();
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function hide() {
    dialogRef.current?.close();
    setOpen(false);
  }

  async function ask(question: string) {
    const text = question.trim().slice(0, 800);
    if (!text || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setDraft("");
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.reply === "string") {
        setTurns([...next, { role: "assistant", content: data.reply }]);
      } else if (res.status === 429) {
        setNotice(
          "That is a lot of questions in a short time. Please wait a few minutes, or talk to a person.",
        );
        setTurns(turns);
        setDraft(text);
      } else {
        setNotice(
          "The assistant could not answer just now. You can try again or talk to a person.",
        );
        setTurns(turns);
        setDraft(text);
      }
    } catch {
      setNotice(
        "The connection failed. You can try again or talk to a person.",
      );
      setTurns(turns);
      setDraft(text);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function startHandoff() {
    const firstQuestion = turns.find((t) => t.role === "user")?.content ?? "";
    setHandoff((h) => ({ ...h, summary: h.summary || firstQuestion }));
    setMode("handoff");
  }

  async function sendHandoff(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/assistant/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...handoff, path: location.pathname }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201 && data.reference) {
        setReference(data.reference);
        setMode("done");
      } else if (res.status === 422) {
        setNotice(
          data.error === "contact"
            ? "Add a phone number or an email so we can reach you."
            : data.error === "consent"
              ? "Please confirm we may contact you."
              : data.error === "name"
                ? "Please add your name."
                : "Please say in a sentence what you need help with.",
        );
      } else {
        setNotice(
          "This could not be sent just now. Please use the contact page instead.",
        );
      }
    } catch {
      setNotice("The connection failed. Please use the contact page instead.");
    } finally {
      setBusy(false);
    }
  }

  const f = (k: string) => `${uid}-${k}`;

  return (
    <>
      <button
        type="button"
        className="ask-launch"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={show}
      >
        <span className="ask-launch__dot" aria-hidden="true" />
        <svg
          className="ask-launch__icon"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6A.5.5 0 0 1 5 19.2V16h0a1 1 0 0 1-1-1V5.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
        <span className="ask-launch__label">Ask Motion</span>
      </button>
      <dialog
        ref={dialogRef}
        className="ask"
        aria-labelledby={f("title")}
        onClose={() => setOpen(false)}
      >
        <div className="ask__head">
          <div>
            <p id={f("title")} className="ask__title">
              Ask Motion
            </p>
            <p className="ask__sub">{subtitle}</p>
          </div>
          <button type="button" className="ask__close" onClick={hide}>
            Close
          </button>
        </div>

        {mode === "chat" ? (
          <>
            <div
              className="ask__log"
              ref={logRef}
              role="log"
              aria-live="polite"
              aria-busy={busy}
            >
              <div className="ask__msg ask__msg--bot">
                Hello. I can explain what we do and point you to the right page.
                I am an AI assistant and can make mistakes; for quotes and
                commitments, talk to a person. Please do not share confidential
                records here.
              </div>
              {turns.length === 0 ? (
                <ul className="ask__suggest" aria-label="Suggested questions">
                  {suggestions.map((s) => (
                    <li key={s}>
                      <button type="button" onClick={() => ask(s)}>
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {turns.map((t, i) => (
                <div
                  key={i}
                  className={`ask__msg ask__msg--${t.role === "user" ? "me" : "bot"}`}
                >
                  <span className="visually-hidden">
                    {t.role === "user" ? "You said: " : "Assistant: "}
                  </span>
                  {t.role === "assistant"
                    ? renderReply(t.content, linkPrefixes)
                    : t.content}
                </div>
              ))}
              {busy ? (
                <div className="ask__msg ask__msg--bot ask__typing">
                  <span className="visually-hidden">Assistant is typing</span>
                  <i />
                  <i />
                  <i />
                </div>
              ) : null}
            </div>
            {notice ? (
              <p className="ask__notice" role="alert">
                {notice}
              </p>
            ) : null}
            <form
              className="ask__form"
              onSubmit={(e) => {
                e.preventDefault();
                ask(draft);
              }}
            >
              <label className="visually-hidden" htmlFor={f("q")}>
                Your question
              </label>
              <textarea
                id={f("q")}
                ref={inputRef}
                rows={2}
                maxLength={800}
                placeholder="Ask about a product, a service or how ordering works"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask(draft);
                  }
                }}
              />
              <button type="submit" disabled={busy || !draft.trim()}>
                Send
              </button>
            </form>
            <div className="ask__human">
              <button type="button" onClick={startHandoff}>
                Talk to a person
              </button>
              {whatsappHref ? (
                <a href={whatsappHref}>
                  WhatsApp <span aria-hidden="true">↗</span>
                </a>
              ) : null}
            </div>
          </>
        ) : null}

        {mode === "handoff" ? (
          <form className="ask__handoff" onSubmit={sendHandoff}>
            {!available ? (
              <p className="ask__lead">
                The assistant is not switched on yet. Leave your details and a
                person from the team will contact you.
              </p>
            ) : (
              <p className="ask__lead">
                A person from the team will contact you. Only this summary and
                your details are sent, not the conversation.
              </p>
            )}
            {notice ? (
              <p className="ask__notice" role="alert">
                {notice}
              </p>
            ) : null}
            <label htmlFor={f("sum")}>What do you need help with?</label>
            <textarea
              id={f("sum")}
              rows={3}
              maxLength={600}
              value={handoff.summary}
              onChange={(e) =>
                setHandoff((h) => ({ ...h, summary: e.target.value }))
              }
            />
            <label htmlFor={f("name")}>Name</label>
            <input
              id={f("name")}
              autoComplete="name"
              value={handoff.name}
              onChange={(e) =>
                setHandoff((h) => ({ ...h, name: e.target.value }))
              }
            />
            <label htmlFor={f("phone")}>Phone or WhatsApp</label>
            <input
              id={f("phone")}
              type="tel"
              autoComplete="tel"
              placeholder="+256"
              value={handoff.phone}
              onChange={(e) =>
                setHandoff((h) => ({ ...h, phone: e.target.value }))
              }
            />
            <label htmlFor={f("email")}>Email (optional)</label>
            <input
              id={f("email")}
              type="email"
              autoComplete="email"
              value={handoff.email}
              onChange={(e) =>
                setHandoff((h) => ({ ...h, email: e.target.value }))
              }
            />
            <div className="hp" aria-hidden="true">
              <label htmlFor={f("web")}>Website</label>
              <input
                id={f("web")}
                tabIndex={-1}
                autoComplete="off"
                value={handoff.website}
                onChange={(e) =>
                  setHandoff((h) => ({ ...h, website: e.target.value }))
                }
              />
            </div>
            <p className="ask__check">
              <input
                id={f("ok")}
                type="checkbox"
                checked={handoff.consent}
                onChange={(e) =>
                  setHandoff((h) => ({ ...h, consent: e.target.checked }))
                }
              />
              <label htmlFor={f("ok")}>You may contact me about this.</label>
            </p>
            <div className="ask__handoff-actions">
              <button type="submit" disabled={busy}>
                {busy ? "Sending…" : "Send to the Team"}
              </button>
              {available ? (
                <button
                  type="button"
                  className="ask__back"
                  onClick={() => setMode("chat")}
                >
                  Back to chat
                </button>
              ) : null}
            </div>
          </form>
        ) : null}

        {mode === "done" ? (
          <div className="ask__done" role="status">
            <p className="ask__title">Sent. Thank you.</p>
            <p>
              Your reference is <strong>{reference}</strong>. A person from the
              team will contact you.
            </p>
            <button type="button" className="ask__back" onClick={hide}>
              Close
            </button>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
