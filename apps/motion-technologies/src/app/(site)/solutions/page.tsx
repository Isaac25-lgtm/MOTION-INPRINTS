import type { Metadata } from "next";
import Link from "next/link";
import {
  Crumbs,
  CtaBand,
  NumberedTitle,
  PageBanner,
} from "@/components/Sections";
import { Img } from "@/components/media/Img";
import { device, photo } from "@/content/media";
import { solutions, visualDevice } from "@/content/solutions";

const description =
  "Health, M&E, business, SACCO, school, POS, website, digital marketing, analytics and custom systems from Motion Imprints Technologies.";

export const metadata: Metadata = {
  title: "Solutions",
  description,
  alternates: { canonical: "/solutions" },
};

export default function SolutionsPage() {
  return (
    <>
      <Crumbs items={[{ label: "Solutions" }]} />
      <PageBanner
        title="Solutions"
        lede="Ten solution families, each configured for the organisation using it. Start with the one closest to your work; we will tell you honestly what fits."
        img={photo("data")}
        position="50% 45%"
      />
      <section className="section container" aria-label="All solutions">
        <ol className="sol-rows">
          {solutions.map((s, i) => (
            <li className="sol-row" key={s.slug}>
              <div className="sol-row__media">
                <Img
                  img={device(visualDevice[s.visual])}
                  sizes="(min-width: 901px) 45vw, 100vw"
                />
              </div>
              <div className="sol-row__copy">
                <NumberedTitle n={i + 1}>{s.name}</NumberedTitle>
                <p className="statement">{s.headline}</p>
                <p>{s.summary}</p>
                <Link className="more" href={`/solutions/${s.slug}`}>
                  Learn more
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <CtaBand
        title="Not sure which one fits?"
        text="Describe the work and the problem. We will suggest where to start, even if it is smaller than you expected."
        img={photo("closing")}
        label="Discuss a project"
      />
    </>
  );
}
