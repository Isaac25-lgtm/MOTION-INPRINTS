import type { Metadata } from "next";
import { defaultOgImages } from "@/lib/og";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CtaBand } from "@/components/CtaBand";
import { SetupBand } from "@/components/SetupBand";
import { Picture, type Frame } from "@/components/media/Picture";
import aboutMedia from "@/content/about-media.json";
import { site } from "@/lib/site";

const description =
  "Motion Imprints designs, prints and produces the physical side of brands: identity, print, signage, packaging, apparel and merchandise.";

export const metadata: Metadata = {
  title: "About",
  description,
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About — Motion Imprints",
    description,
    images: defaultOgImages,
  },
};

type Built = { widths: number[]; width: number; height: number };
const media = aboutMedia as Record<string, Built>;
const frame = (slug: string, alt: string): Frame => ({
  base: `/media/about/${slug}`,
  ...media[slug],
  alt,
});

// Genuine archive photographs, approved by the owner for publication.
const inProduction = [
  {
    frame: frame(
      "wide-format-printing",
      "A wide-format printer printing a repeating logo banner.",
    ),
    caption: "Wide-format printing",
  },
  {
    frame: frame(
      "fascia-fabrication",
      "A teal shop fascia on the workbench with white raised letters being fixed to it.",
    ),
    caption: "A fascia during fabrication",
  },
  {
    frame: frame(
      "flatbed-printing",
      "Gold plaques laid out on the bed of a flatbed printer.",
    ),
    caption: "Plaques on a flatbed printer",
  },
];

const principles = [
  {
    title: "Design sits next to production",
    text: "Artwork is prepared by people who know how it will be printed, cut or fitted, so what you approve is what can be made.",
  },
  {
    title: "One team for the whole job",
    text: "Identity, print, signage, packaging and merchandise are planned together, so the pieces look like one brand.",
  },
  {
    title: "You approve before we make",
    text: "Every job starts with a quotation and a proof. Nothing goes into production until you have agreed both.",
  },
];

export default function AboutPage() {
  return (
    <>
      <header className="page-head container">
        <Breadcrumbs items={[{ label: "About" }]} />
        <div className="page-head__grid">
          <h1 className="display page-head__title">
            We make the side of a brand people can touch
          </h1>
          <p className="lede">
            {site.name} is a creative and production company. We design, print
            and produce identity, stationery, signage, packaging, apparel and
            merchandise for businesses and institutions.
          </p>
        </div>
      </header>

      <section className="container about-media" aria-label="In production">
        <ul>
          {inProduction.map((item) => (
            <li key={item.caption}>
              <figure>
                <div className="about-media__frame">
                  <Picture
                    frame={item.frame}
                    sizes="(min-width: 901px) 31vw, 92vw"
                  />
                </div>
                <figcaption>{item.caption}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      <section className="container about-principles" aria-labelledby="how">
        <div className="section-intro">
          <p className="eyebrow">How we work</p>
          <h2 id="how" className="display">
            From artwork to the finished piece
          </h2>
        </div>
        <ol>
          {principles.map((p, i) => (
            <li key={p.title}>
              <p className="process__num" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </li>
          ))}
        </ol>
        <p className="about-principles__more">
          <Link className="textlink" href="/services">
            See the six services <span aria-hidden="true">→</span>
          </Link>
        </p>
      </section>

      <SetupBand />

      <CtaBand
        title="Starting something new?"
        text="Tell us about the business, the space or the product. We will suggest what to make first."
        secondary={{ href: "/work", label: "See Our Work" }}
      />
    </>
  );
}
