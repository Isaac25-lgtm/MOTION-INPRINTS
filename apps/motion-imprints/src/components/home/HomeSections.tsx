import type { CSSProperties } from "react";
import Link from "next/link";
import { Picture } from "@/components/media/Picture";
import {
  capabilities,
  closingCopy,
  cta,
  featured,
  featuredCopy,
  hero,
  heroCopy,
  processCopy,
  services,
  servicesCopy,
  steps,
  workCopy,
  workLead,
  workSupport,
} from "@/content/homepage";

/** Full-bleed hero. The copy sits on a measured scrim, never on bare photo. */
export function Hero() {
  return (
    <section className="home-hero on-dark" id="hero">
      <div className="home-hero__media">
        <Picture frame={hero.wide} narrow={hero.tall} sizes="100vw" priority />
      </div>
      <div className="home-hero__copy">
        <h1>
          <span>{heroCopy.titleLines[0]}</span>{" "}
          <span>{heroCopy.titleLines[1]}</span>
        </h1>
        <p className="home-hero__lede">{heroCopy.lede}</p>
        <div className="actions">
          <Link className="btn btn--light" href="/contact">
            Start a Project
          </Link>
          <Link className="btn btn--outline" href="/work">
            View Work
          </Link>
        </div>
      </div>
    </section>
  );
}

function CapabilityGroup() {
  return (
    <ul>
      {capabilities.map((item) => (
        <li key={item}>
          <span>{item}</span>
          <i aria-hidden="true" />
        </li>
      ))}
    </ul>
  );
}

/** Moving capability rail. The names are announced once, not twice: the track
 *  is hidden from assistive technology and the static list carries them. */
export function CapabilityRail() {
  return (
    <section className="home-rail on-dark" id="rail" aria-label="Capabilities">
      <p className="visually-hidden home-rail__sr">{capabilities.join(", ")}</p>
      <div className="home-rail__viewport" aria-hidden="true">
        <div className="home-rail__track">
          <CapabilityGroup />
          <CapabilityGroup />
        </div>
      </div>
      <ul className="home-rail__static">
        {capabilities.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function ServiceGrid() {
  return (
    <section className="home-section" id="services">
      <div className="container">
        <div className="home-intro">
          <div>
            <p className="eyebrow">{servicesCopy.eyebrow}</p>
            <h2 className="display">{servicesCopy.title}</h2>
          </div>
          <p>{servicesCopy.lede}</p>
        </div>
        <div className="home-services">
          {services.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className={`home-card on-dark home-card--${card.area}`}
            >
              <Picture
                frame={card.frame}
                sizes="(min-width: 1025px) 45vw, (min-width: 701px) 50vw, 92vw"
              />
              <div className="home-card__copy">
                <h3 className="home-card__title">{card.title}</h3>
                <p className="home-card__text">{card.text}</p>
                <span className="home-card__link">
                  View service <i aria-hidden="true">→</i>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeaturedProject() {
  return (
    <section className="home-featured" id="featured">
      <div className="home-featured__media">
        <Picture frame={featured} sizes="(min-width: 901px) 58vw, 100vw" />
      </div>
      <div className="home-featured__copy">
        <p className="eyebrow">{featuredCopy.eyebrow}</p>
        <h2 className="display">{featuredCopy.title}</h2>
        <p>{featuredCopy.lede}</p>
        <ul className="tags">
          {featuredCopy.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
        <Link className="textlink" href="/work">
          View work <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

function WorkFigure({
  item,
  sizes,
}: {
  item: { label: string; frame: Parameters<typeof Picture>[0]["frame"] };
  sizes: string;
}) {
  return (
    <figure
      className="home-work__item"
      style={{ "--ar": item.frame.width / item.frame.height } as CSSProperties}
    >
      <div className="home-work__frame">
        <Picture frame={item.frame} sizes={sizes} />
      </div>
      <figcaption>{item.label}</figcaption>
    </figure>
  );
}

/** Genuine Motion photographs only. Stock and presentation mockups never
 *  appear here: see the register in docs/phase-3-4-rescue. */
export function SelectedWork() {
  return (
    <section className="home-section" id="work">
      <div className="container">
        <div className="home-intro">
          <div>
            <p className="eyebrow">{workCopy.eyebrow}</p>
            <h2 className="display">{workCopy.title}</h2>
          </div>
          <p>{workCopy.lede}</p>
        </div>
        <div className="home-work">
          <div className="home-work__row home-work__row--lead">
            {workLead.map((item) => (
              <WorkFigure
                key={item.label}
                item={item}
                sizes="(min-width: 701px) 48vw, 92vw"
              />
            ))}
          </div>
          <div className="home-work__row home-work__row--support">
            {workSupport.map((pair) => (
              <div key={pair[0].label} className="home-work__pair">
                {pair.map((item) => (
                  <WorkFigure
                    key={item.label}
                    item={item}
                    sizes="(min-width: 701px) 28vw, 46vw"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className="home-work__more">
          <Link className="textlink" href="/work">
            Browse all work <span aria-hidden="true">→</span>
          </Link>
        </p>
      </div>
    </section>
  );
}

export function ProcessSteps() {
  return (
    <section className="home-section home-section--process" id="process">
      <div className="container">
        <div className="home-intro">
          <div>
            <p className="eyebrow">{processCopy.eyebrow}</p>
            <h2 className="display">{processCopy.title}</h2>
          </div>
          <p>{processCopy.lede}</p>
        </div>
        <ol className="home-steps">
          {steps.map((step) => (
            <li key={step.title}>
              <div className="home-steps__frame">
                <Picture
                  frame={step.frame}
                  sizes="(min-width: 901px) 23vw, 46vw"
                />
              </div>
              <p className="home-steps__index">{step.index}</p>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ClosingCta() {
  return (
    <section className="home-cta on-dark" id="cta">
      <div className="home-cta__copy">
        <h2 className="display">{closingCopy.title}</h2>
        <p>{closingCopy.lede}</p>
        <div className="actions">
          <Link className="btn btn--light" href="/contact">
            Request a Quotation
          </Link>
          <Link className="btn btn--outline" href="/services">
            Browse Services
          </Link>
        </div>
      </div>
      <div className="home-cta__media">
        <Picture frame={cta} sizes="(min-width: 801px) 45vw, 100vw" />
      </div>
    </section>
  );
}
