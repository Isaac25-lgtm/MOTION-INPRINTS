import type { Metadata } from "next";
import Link from "next/link";
import {
  Crumbs,
  CtaBand,
  NumberedTitle,
  PageBanner,
} from "@/components/Sections";
import { Img } from "@/components/media/Img";
import { photo } from "@/content/media";
import { site } from "@/lib/site";

const description =
  "Motion Imprints Technologies is the technology division of Motion Imprints: systems, data and digital platforms built around real work.";

export const metadata: Metadata = {
  title: "About",
  description,
  alternates: { canonical: "/about" },
};

const principles = [
  {
    title: "Start with the work",
    text: "We learn how the work runs today before proposing screens. The system follows the process, not the other way round.",
  },
  {
    title: "Build in visible stages",
    text: "Working releases early and often, so you can steer and nothing is a surprise at the end.",
  },
  {
    title: "Your data stays yours",
    text: "Ownership, hosting, access and backups are agreed at the start and written down.",
  },
  {
    title: "Plain language",
    text: "Proposals and reports you can read without a technical glossary, including what is out of scope.",
  },
  {
    title: "Support after launch",
    text: "Fixes, improvements and hosting under an agreed arrangement, not a handover and goodbye.",
  },
  {
    title: "Honest claims",
    text: "We describe what a system does and what it can be configured to do. No invented results.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Crumbs items={[{ label: "About" }]} />
      <PageBanner
        title="About Motion Imprints Technologies"
        lede={`${site.relationship}. ${site.parentName} makes the physical side of a brand; we build the systems, data and digital platforms organisations run on.`}
        img={photo("who-we-are")}
        position="50% 30%"
      />

      <section className="section container split" aria-labelledby="who">
        <div className="split__media">
          <Img
            img={photo("approach")}
            sizes="(min-width: 901px) 45vw, 100vw"
            position="50% 40%"
          />
        </div>
        <div className="split__copy">
          <h2 id="who" className="title">
            Who we are
          </h2>
          <p className="statement">
            Systems built around real work, for health facilities, programmes,
            SACCOs, schools and businesses that need their records, workflows
            and reports to hold together.
          </p>
          <a className="more" href={site.parentUrl}>
            Visit {site.parentName}
          </a>
        </div>
      </section>

      <section className="section container block" aria-labelledby="how">
        <NumberedTitle n={1} id="how">
          Six commitments on every project
        </NumberedTitle>
        <p className="kicker block__kicker">How we work</p>
        <ol className="steps">
          {principles.map((p, i) => (
            <li key={p.title}>
              <span className="steps__num">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section section--grey" aria-labelledby="group">
        <div className="container path">
          <div>
            <h2 id="group" className="title">
              One group, two companies
            </h2>
            <p className="statement">Physical and digital, planned together.</p>
          </div>
          <ol className="path__steps">
            <li>
              <span className="path__num">01</span>
              <h3>{site.parentName}</h3>
              <p>Identity, print, signage, packaging and merchandise.</p>
              <a className="more" href={site.parentUrl}>
                Visit {site.parentName}
              </a>
            </li>
            <li className="dark">
              <span className="path__num">02</span>
              <h3>{site.name}</h3>
              <p>
                Business systems, POS, websites, digital marketing, analytics
                and sector systems.
              </p>
              <Link className="more" href="/solutions">
                Explore solutions
              </Link>
            </li>
          </ol>
        </div>
      </section>

      <CtaBand
        title="Tell us about the work"
        text="What you do, what gets in the way, and who would use a system. We will take it from there."
        img={photo("closing")}
      />
    </>
  );
}
