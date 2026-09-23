import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Crumbs,
  CtaBand,
  NumberedTitle,
  PageBanner,
  SolutionBlock,
} from "@/components/Sections";
import { Img } from "@/components/media/Img";
import { device, photo } from "@/content/media";
import {
  bannerPhoto,
  getSolution,
  solutions,
  visualDevice,
} from "@/content/solutions";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return solutions.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = getSolution(slug);
  if (!s) return {};
  const shot = device(visualDevice[s.visual]);
  return {
    title: s.name,
    description: s.lede,
    alternates: { canonical: `/solutions/${s.slug}` },
    openGraph: {
      title: `${s.name} | Motion Imprints Technologies`,
      description: s.lede,
      images: [
        {
          url: `${shot.base}-${shot.widths[0]}.webp`,
          width: shot.width,
          height: shot.height,
          alt: shot.alt,
        },
      ],
    },
  };
}

/** Solutions that offer a demonstration as a second action. */
const demoable = new Set([
  "health",
  "monitoring-evaluation",
  "sacco",
  "education",
  "pos-retail",
  "business",
]);

export default async function SolutionPage({ params }: Props) {
  const { slug } = await params;
  const s = getSolution(slug);
  if (!s) notFound();

  const contactHref = `/contact?solution=${s.slug}`;
  const banner = bannerPhoto[s.slug];
  const related = s.related
    .map((r) => getSolution(r))
    .filter((r) => r !== null);
  let n = 1;

  return (
    <>
      <Crumbs
        items={[{ href: "/solutions", label: "Solutions" }, { label: s.name }]}
      />
      <PageBanner
        title={s.name}
        lede={s.lede}
        img={photo(banner.img)}
        position={banner.position}
      >
        <div className="actions">
          <Link className="btn btn--accent" href={contactHref}>
            {s.cta}
          </Link>
          {demoable.has(s.slug) ? (
            <Link className="btn btn--line" href={`${contactHref}&type=demo`}>
              Request a Demonstration
            </Link>
          ) : null}
        </div>
      </PageBanner>

      <section className="section container intro" aria-labelledby="overview">
        <div className="intro__media">
          <Img
            img={device(visualDevice[s.visual])}
            sizes="(min-width: 901px) 55vw, 100vw"
          />
        </div>
        <div className="intro__copy">
          <NumberedTitle n={n++} id="overview">
            {s.headline}
          </NumberedTitle>
          <p>{s.problem}</p>
          <p className="featured__note">
            On screen: our design, with invented sample data.
          </p>
        </div>
      </section>

      {s.blocks.map((block) => (
        <SolutionBlock key={block.title} block={block} n={n++} />
      ))}

      <section className="section container" aria-labelledby="facts">
        <NumberedTitle n={n++} id="facts">
          Users, connections and data
        </NumberedTitle>
        <div className="featured" style={{ marginTop: 28 }}>
          <div>
            <h3>Who uses it</h3>
            <ul>
              {s.roles.map((r) => (
                <li key={r.role}>
                  <b>{r.role}</b>
                  {r.does}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Connects to</h3>
            <ul>
              {s.integrations.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            <p className="featured__note">{s.integrations.note}</p>
          </div>
          <div>
            <h3>Data and security</h3>
            <ul>
              {s.data.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section
        className="section section--grey"
        aria-labelledby="related-title"
      >
        <div className="container">
          <h2 id="related-title" className="title">
            Often combined with
          </h2>
          <ul className="related">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/solutions/${r.slug}`}>
                  <span className="related__media">
                    <Img
                      img={device(visualDevice[r.visual])}
                      sizes="(min-width: 901px) 31vw, 100vw"
                      decorative
                    />
                  </span>
                  <strong>{r.name}</strong>
                  <span>{r.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand
        title={`Talk to us about ${s.name.toLowerCase()}`}
        text="Tell us how the work runs today. The first conversation is about understanding it, not selling a package."
        img={photo("closing")}
        href={contactHref}
        label={s.cta}
      />
    </>
  );
}
