import Link from "next/link";

type Props = {
  title: string;
  text: string;
  href?: string;
  label?: string;
  secondary?: { href: string; label: string };
  /** Optional checklist of what to include in a brief. */
  brief?: string[];
};

/** Closing call to action for interior pages. */
export function CtaBand({
  title,
  text,
  href = "/contact",
  label = "Request a Quotation",
  secondary,
  brief,
}: Props) {
  return (
    <section className="cta-band on-dark" aria-labelledby="cta-band-title">
      <div className="container cta-band__inner">
        <div>
          <h2 id="cta-band-title" className="display">
            {title}
          </h2>
          <p className="cta-band__text">{text}</p>
          <div className="actions">
            <Link className="btn btn--light" href={href}>
              {label}
            </Link>
            {secondary ? (
              <Link className="btn btn--outline" href={secondary.href}>
                {secondary.label}
              </Link>
            ) : null}
          </div>
        </div>
        {brief ? (
          <div className="cta-band__brief">
            <p className="eyebrow eyebrow--light">A useful brief includes</p>
            <ul>
              {brief.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
