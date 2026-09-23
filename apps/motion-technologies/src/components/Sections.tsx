import Link from "next/link";
import type { ReactNode } from "react";
import { Img } from "@/components/media/Img";
import type { Img as ImgData } from "@/content/media";
import type { Block } from "@/content/solutions";

/** Accent bar with a back link and the breadcrumb trail (inner pages). */
export function Crumbs({
  items,
}: {
  items: { href?: string; label: string }[];
}) {
  const parent = [...items].reverse().find((i) => i.href);
  return (
    <div className="crumbbar">
      <nav className="container crumbbar__inner" aria-label="Breadcrumb">
        <Link className="crumbbar__back" href={parent?.href ?? "/"}>
          <span aria-hidden="true">‹</span> {parent?.label ?? "Home"}
        </Link>
        <ol>
          <li>
            <Link href="/">Home</Link>
          </li>
          {items.map((item, i) =>
            item.href && i < items.length - 1 ? (
              <li key={item.label}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ) : (
              <li key={item.label} aria-current="page">
                {item.label}
              </li>
            ),
          )}
        </ol>
      </nav>
    </div>
  );
}

/** Dark photo banner that opens every inner page. */
export function PageBanner({
  title,
  lede,
  img,
  position,
  children,
}: {
  title: string;
  lede: string;
  img: ImgData;
  position?: string;
  children?: ReactNode;
}) {
  return (
    <header className="banner dark">
      <Img
        img={img}
        sizes="100vw"
        priority
        className="banner__media"
        position={position}
        decorative
      />
      <div className="banner__shade" aria-hidden="true" />
      <div className="container banner__inner">
        <h1 className="banner__title">{title}</h1>
        <p className="banner__lede">{lede}</p>
        {children}
      </div>
    </header>
  );
}

/** Closing call to action on a darkened photograph. */
export function CtaBand({
  title,
  img,
  href = "/contact",
  label = "Contact us",
  text,
}: {
  title: string;
  img: ImgData;
  href?: string;
  label?: string;
  text?: string;
}) {
  return (
    <section className="ctaband dark" aria-labelledby="ctaband-title">
      <Img img={img} sizes="100vw" className="ctaband__media" decorative />
      <div className="ctaband__shade" aria-hidden="true" />
      <div className="container ctaband__inner">
        <h2 id="ctaband-title" className="ctaband__title">
          {title}
        </h2>
        {text ? <p className="ctaband__text">{text}</p> : null}
        <Link className="btn btn--line" href={href}>
          {label} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

/** Numbered section heading used on inner pages ("1. The problem"). */
export function NumberedTitle({
  n,
  children,
  id,
}: {
  n: number;
  children: ReactNode;
  id?: string;
}) {
  return (
    <h2 className="numbered" id={id}>
      {n}. {children}
    </h2>
  );
}

/** A solution page block. The kind decides the composition. */
export function SolutionBlock({ block, n }: { block: Block; n: number }) {
  const head = (
    <>
      <NumberedTitle n={n}>{block.title}</NumberedTitle>
      <p className="kicker block__kicker">{block.eyebrow}</p>
    </>
  );
  switch (block.kind) {
    case "workflow":
      return (
        <section className="section container block">
          {head}
          <ol className="steps">
            {block.steps.map((s, i) => (
              <li key={s.title}>
                <span className="steps__num">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
      );
    case "modules":
      return (
        <section className="section container block">
          {head}
          {block.intro ? <p className="block__intro">{block.intro}</p> : null}
          <ul className="modules">
            {block.items.map((m) => (
              <li key={m.title}>
                <h3>{m.title}</h3>
                <p>{m.text}</p>
              </li>
            ))}
          </ul>
        </section>
      );
    case "contrast":
      return (
        <section className="section container block">
          {head}
          <div className="contrast">
            <div>
              <h3>Today</h3>
              <ul>
                {block.before.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
            <div className="dark">
              <h3>With the system</h3>
              <ul>
                {block.after.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      );
    case "questions":
      return (
        <section className="section container block">
          {head}
          <div className="faq">
            {block.items.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      );
  }
}
