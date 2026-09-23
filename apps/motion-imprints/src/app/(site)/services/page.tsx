import type { Metadata } from "next";
import { defaultOgImages } from "@/lib/og";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CtaBand } from "@/components/CtaBand";
import { SetupBand } from "@/components/SetupBand";
import { Picture } from "@/components/media/Picture";
import { serviceDetails } from "@/content/services";
import { getWorkItem } from "@/content/work";
import { services } from "@/lib/nav";

const description =
  "Design, printing, branding, signage, packaging and corporate merchandise from one Motion Imprints team, from artwork to the finished piece.";

export const metadata: Metadata = {
  title: "Services",
  description,
  alternates: { canonical: "/services" },
  openGraph: {
    title: "Services — Motion Imprints",
    description,
    images: defaultOgImages,
  },
};

const process = [
  {
    title: "Brief",
    text: "You tell us what you need, where it will be used, how many and by when.",
  },
  {
    title: "Design and proof",
    text: "Artwork is prepared or checked, and you approve a proof before anything is made.",
  },
  {
    title: "Produce",
    text: "Printing, cutting, embroidery or fabrication on the agreed material.",
  },
  {
    title: "Finish and hand over",
    text: "Trimmed, assembled and checked, then collected, delivered or installed.",
  },
];

export default function ServicesPage() {
  return (
    <>
      <header className="page-head container">
        <Breadcrumbs items={[{ label: "Services" }]} />
        <div className="page-head__grid">
          <h1 className="display page-head__title">
            Six services, one production team
          </h1>
          <p className="lede">
            From the first sketch of a logo to the sign fixed above your door.
            Each service can be ordered on its own or planned together.
          </p>
        </div>
      </header>

      <section className="container svc-index" aria-label="All services">
        <ul>
          {services.map((service) => {
            const detail = serviceDetails[service.slug];
            const hero = getWorkItem(detail.work[0]);
            return (
              <li key={service.slug}>
                <Link
                  className="svc-index__card"
                  href={`/services/${service.slug}`}
                >
                  <div className="svc-index__frame">
                    <Picture
                      frame={hero.frame}
                      sizes="(min-width: 1025px) 30vw, (min-width: 701px) 46vw, 92vw"
                    />
                  </div>
                  <div className="svc-index__body">
                    <p className="svc-index__num" aria-hidden="true">
                      {detail.index}
                    </p>
                    <h2>{service.title}</h2>
                    <p>{detail.lede}</p>
                    <span className="textlink">
                      {service.title} in detail{" "}
                      <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="process" aria-labelledby="process-title">
        <div className="container">
          <div className="section-intro">
            <p className="eyebrow">How a job runs</p>
            <h2 id="process-title" className="display">
              Four steps, whatever you order
            </h2>
          </div>
          <ol className="process__steps">
            {process.map((step, i) => (
              <li key={step.title}>
                <p className="process__num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <SetupBand />

      <CtaBand
        title="Have a brief?"
        text="Send what you know so far. Sizes, quantities and a deadline are enough to start a quotation."
        secondary={{ href: "/products", label: "Browse Products" }}
      />
    </>
  );
}
