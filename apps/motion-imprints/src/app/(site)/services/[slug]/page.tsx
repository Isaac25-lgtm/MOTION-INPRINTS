import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CtaBand } from "@/components/CtaBand";
import { SetupBand } from "@/components/SetupBand";
import { Picture } from "@/components/media/Picture";
import { WorkTile } from "@/components/work/WorkTile";
import { serviceDetails } from "@/content/services";
import { getWorkItem } from "@/content/work";
import { getService, services } from "@/lib/nav";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return {};
  const detail = serviceDetails[service.slug];
  const hero = getWorkItem(detail.work[0]);
  return {
    title: service.title,
    description: detail.lede,
    alternates: { canonical: `/services/${service.slug}` },
    openGraph: {
      title: `${service.title} — Motion Imprints`,
      description: detail.lede,
      images: [
        {
          url: `${hero.frame.base}-${hero.frame.widths[0]}.webp`,
          width: hero.frame.width,
          height: hero.frame.height,
          alt: hero.frame.alt,
        },
      ],
    },
  };
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  const detail = serviceDetails[service.slug];
  const [hero, ...gallery] = detail.work.map(getWorkItem);
  const related = detail.related
    .map((s) => getService(s))
    .filter((s) => s !== null);
  const quoteHref = `/contact?service=${service.slug}`;
  const workHref = detail.workCategory
    ? `/work?category=${detail.workCategory}`
    : "/work";

  return (
    <>
      <header className="svc-hero container">
        <div className="svc-hero__copy">
          <Breadcrumbs
            items={[
              { href: "/services", label: "Services" },
              { label: service.title },
            ]}
          />
          <p className="eyebrow">
            {detail.index} · {service.title}
          </p>
          <h1 className="display svc-hero__title">{detail.headline}</h1>
          <p className="lede">{detail.lede}</p>
          <div className="actions">
            <Link className="btn btn--solid" href={quoteHref}>
              Request a Quotation
            </Link>
            <Link className="btn btn--ghost" href={workHref}>
              See Related Work
            </Link>
          </div>
        </div>
        <figure className="svc-hero__media">
          <Picture
            frame={hero.frame}
            sizes="(min-width: 901px) 50vw, 100vw"
            priority
          />
          <figcaption>{hero.title}</figcaption>
        </figure>
      </header>

      <section className="container svc-intro" aria-label="Overview">
        <p>{detail.intro}</p>
      </section>

      <section
        className="container svc-deliver"
        aria-labelledby="deliver-title"
      >
        <div className="section-intro">
          <p className="eyebrow">What we make</p>
          <h2 id="deliver-title" className="display">
            {service.title} deliverables
          </h2>
        </div>
        <ul className="svc-deliver__grid">
          {detail.deliverables.map((d) => (
            <li key={d.title}>
              <h3>{d.title}</h3>
              <p>{d.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="svc-uses" aria-labelledby="uses-title">
        <div className="container svc-uses__inner">
          <div>
            <p className="eyebrow">Where it is used</p>
            <h2 id="uses-title" className="display">
              Common applications
            </h2>
            <ul className="svc-uses__list">
              {detail.applications.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Getting it right</p>
            <h2 className="display">Before you order</h2>
            <ol className="svc-notes">
              {detail.considerations.map((c) => (
                <li key={c.title}>
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="container svc-work" aria-labelledby="work-title">
        <div className="section-intro section-intro--split">
          <div>
            <p className="eyebrow">From the archive</p>
            <h2 id="work-title" className="display">
              Related pieces
            </h2>
          </div>
          <Link className="textlink" href={workHref}>
            Browse all work <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="work-grid work-grid--four">
          {gallery.map((item) => (
            <WorkTile
              key={item.slug}
              item={item}
              sizes="(min-width: 1025px) 23vw, 46vw"
            />
          ))}
        </div>
      </section>

      <nav className="container svc-related" aria-labelledby="related-title">
        <h2 id="related-title" className="eyebrow">
          Related services
        </h2>
        <ul>
          {related.map((r) => (
            <li key={r.slug}>
              <Link href={`/services/${r.slug}`}>
                <strong>{r.title}</strong>
                <span>{r.summary}</span>
                <i aria-hidden="true">→</i>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {detail.technologies ? <SetupBand /> : null}

      <CtaBand
        title={`Start a ${service.title.toLowerCase()} brief`}
        text="Tell us what you need and we will come back with questions or a quotation."
        href={quoteHref}
        brief={detail.brief}
      />
    </>
  );
}
