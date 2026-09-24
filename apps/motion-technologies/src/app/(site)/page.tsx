import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/Sections";
import { HeroVideo } from "@/components/media/HeroVideo";
import { Img } from "@/components/media/Img";
import { device, heroVideo, photo } from "@/content/media";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Systems built around real work",
  description: site.description,
  alternates: { canonical: "/" },
};

const whatWeDo = [
  {
    kicker: "Health systems",
    text: "Digital records and reporting built around how a facility runs.",
    href: "/solutions/health",
    img: "health",
    position: "50% 25%",
  },
  {
    kicker: "M&E and data",
    text: "Programme data that flows from the field to the report.",
    href: "/solutions/monitoring-evaluation",
    img: "data",
    position: "40% 50%",
  },
  {
    kicker: "SACCO and finance",
    text: "Member savings and loans with approvals and an audit trail.",
    href: "/solutions/sacco",
    img: "finance",
    position: "50% 55%",
  },
  {
    kicker: "Schools",
    text: "Admissions, fees, attendance and report cards in one place.",
    href: "/solutions/education",
    img: "education",
    position: "50% 50%",
  },
  {
    kicker: "POS and business",
    text: "A fast counter with stock and branch reports behind it.",
    href: "/solutions/pos-retail",
    img: "retail",
    position: "60% 50%",
  },
  {
    kicker: "Websites and digital marketing",
    text: "Get found online and turn attention into enquiries.",
    href: "/solutions/digital-marketing",
    img: "digital",
    position: "50% 30%",
  },
];

const apart = [
  {
    title: "Built around real work",
    text: "We map how records, approvals and reports move today, then build the system to fit the people who use it.",
    img: "real-work",
  },
  {
    title: "Connected",
    text: "Survey tools, spreadsheets, mobile money, SMS and national reporting formats, connected where you are authorised.",
    img: "connected",
  },
  {
    title: "Secure by design",
    text: "Roles, approvals, audit trails and agreed backups are decided at the start and written down.",
    img: "secure",
  },
];

// Only confirmed facts: name, site and logo.
const organisation = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  url: site.url,
  logo: `${site.url}/brand/logo-technologies.png`,
};

export default function HomePage() {
  const wide = heroVideo["hero-wide"];
  const tall = heroVideo["hero-tall"];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organisation) }}
      />

      <section className="hero dark" aria-labelledby="hero-title">
        <HeroVideo
          wide={{
            src: wide.src,
            poster: `${wide.poster.base}-${wide.poster.widths[0]}.webp`,
          }}
          tall={{
            src: tall.src,
            poster: `${tall.poster.base}-${tall.poster.widths[0]}.webp`,
          }}
        />
        <div className="hero__shade" aria-hidden="true" />
        <div className="container hero__inner">
          <h1 id="hero-title" className="hero__title">
            <span>Built Around</span>
            <span className="hero__accent">Real Work</span>
          </h1>
          <div className="hero__side">
            <p className="hero__we">We are {site.name}</p>
            <p>
              We design and build the systems, platforms and digital marketing
              that health facilities, programmes, SACCOs, schools and businesses
              run on.
            </p>
            <Link className="more" href="/solutions">
              Explore our solutions
            </Link>
          </div>
        </div>
      </section>

      <section className="section container split" aria-labelledby="who">
        <div className="split__media">
          <Img
            img={photo("who-we-are")}
            sizes="(min-width: 901px) 45vw, 100vw"
            position="50% 35%"
          />
        </div>
        <div className="split__copy">
          <h2 id="who" className="title">
            Who we are
          </h2>
          <p className="statement">
            {site.name} builds health, M&amp;E, SACCO, school, retail and web
            systems for organisations that run on records.
          </p>
          <p>
            We start with the work: how records move, who approves what, and
            what managers need to see. Then we build the system around it,
            connect it to the tools you already use and support it after launch.
          </p>
          <Link className="more" href="/about">
            Learn more
          </Link>
        </div>
      </section>

      <section className="section section--flush" aria-labelledby="what">
        <div className="container">
          <h2 id="what" className="title">
            What we do
          </h2>
          <ul className="cards">
            {whatWeDo.map((c) => (
              <li key={c.href}>
                <Link className="card dark" href={c.href}>
                  <Img
                    img={photo(c.img)}
                    sizes="(min-width: 901px) 31vw, (min-width: 601px) 48vw, 100vw"
                    position={c.position}
                    decorative
                  />
                  <span className="card__copy">
                    <span className="card__kicker">{c.kicker}</span>
                    <span className="card__text">{c.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="cards__more">
            <Link className="more" href="/solutions">
              All ten solutions
            </Link>
          </p>
        </div>
      </section>

      <section className="container mission" aria-labelledby="mission">
        <h2 id="mission" className="title">
          Our mission
        </h2>
        <p>
          To build dependable systems that help organisations do their real work
          better, and to give growing businesses one partner from their first
          sign to their first campaign.
        </p>
      </section>

      <section className="section container split" aria-labelledby="approach">
        <div className="split__media">
          <Img
            img={photo("approach")}
            sizes="(min-width: 901px) 45vw, 100vw"
            position="50% 40%"
          />
        </div>
        <div className="split__copy">
          <h2 id="approach" className="title">
            Our approach
          </h2>
          <p className="statement">
            BUILT AROUND REAL WORK means listening before building.
          </p>
          <p>
            Most systems fail because they ask people to change how they work to
            suit the software. We do the opposite: we sit with the people who
            register patients, approve loans, count stock or collect field data,
            and design around what they actually do.
          </p>
          <p>
            Then we build in small, visible stages, so you see working software
            early and decide what comes next.
          </p>
          <Link className="more" href="/about">
            Learn more
          </Link>
        </div>
      </section>

      <section className="section showcase dark" aria-labelledby="screens">
        <div className="container">
          <div className="showcase__head">
            <h2 id="screens" className="title">
              See it on screen
            </h2>
            <p>
              Our own interface designs on real devices. The figures on screen
              are invented sample data.
            </p>
          </div>
          <div className="showcase__grid">
            <figure className="showcase__main">
              <Img
                img={device("laptop-me")}
                sizes="(min-width: 901px) 62vw, 100vw"
                position="50% 35%"
              />
              <figcaption>M&amp;E results framework</figcaption>
            </figure>
            <figure>
              <Img
                img={device("phone-field")}
                sizes="(min-width: 901px) 30vw, 100vw"
                position="55% 45%"
              />
              <figcaption>Field data collection, offline</figcaption>
            </figure>
            <figure>
              <Img
                img={device("phone-shop")}
                sizes="(min-width: 901px) 30vw, 100vw"
                position="50% 55%"
              />
              <figcaption>A shop&apos;s day on a phone</figcaption>
            </figure>
            <figure className="showcase__wide">
              <Img
                img={device("laptop-business")}
                sizes="(min-width: 901px) 62vw, 100vw"
                position="50% 40%"
              />
              <figcaption>Owner&apos;s dashboard</figcaption>
            </figure>
          </div>
          <p className="showcase__more">
            <Link className="more" href="/work">
              View demonstrations
            </Link>
          </p>
        </div>
      </section>

      <section className="section container" aria-labelledby="apart">
        <h2 id="apart" className="title">
          What sets us apart
        </h2>
        <ul className="apart">
          {apart.map((a) => (
            <li key={a.title}>
              <div className="apart__media">
                <Img
                  img={photo(a.img)}
                  sizes="(min-width: 901px) 31vw, 100vw"
                  decorative
                />
              </div>
              <h3>{a.title}</h3>
              <p>{a.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section section--grey" aria-labelledby="path">
        <div className="container path">
          <div>
            <h2 id="path" className="title">
              From opening day to online
            </h2>
            <p className="statement">
              We can take a new business from its first sale to its first
              customers online.
            </p>
          </div>
          <ol className="path__steps">
            <li>
              <span className="path__num">01</span>
              <h3>Systems and point of sale</h3>
              <p>
                The counter, the stock, the records and the reports: the systems
                the business runs on from day one.
              </p>
              <Link className="more" href="/solutions/pos-retail">
                Point of sale and retail
              </Link>
            </li>
            <li className="dark">
              <span className="path__num">02</span>
              <h3>Website and digital marketing</h3>
              <p>
                The website, the search and social profiles and the campaigns:
                the digital front door that brings the first customers in.
              </p>
              <Link className="more" href="/solutions/digital-marketing">
                Digital marketing for new businesses
              </Link>
            </li>
          </ol>
        </div>
      </section>

      <section className="container facts" aria-label="At a glance">
        <ul>
          <li>
            <b>10</b>
            <span>Solution families</span>
          </li>
          <li>
            <b>6</b>
            <span>Delivery stages on every project</span>
          </li>
          <li>
            <b>5</b>
            <span>Sectors we build for</span>
          </li>
        </ul>
      </section>

      <CtaBand
        title="Let's build around your work"
        img={photo("closing")}
        href="/contact"
        label="Contact us"
      />
    </>
  );
}
