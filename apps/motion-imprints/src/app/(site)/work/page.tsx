import type { Metadata } from "next";
import { defaultOgImages } from "@/lib/og";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CtaBand } from "@/components/CtaBand";
import { Picture } from "@/components/media/Picture";
import { WorkTile } from "@/components/work/WorkTile";
import {
  categoryLabel,
  collectionItems,
  collections,
  isCategory,
  workCategories,
  workItems,
} from "@/content/work";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const description =
  "Signs, interiors, print, packaging, merchandise and event pieces photographed in the Motion Imprints workshop and on site.";

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { category } = await searchParams;
  const active = isCategory(category) ? category : null;
  return {
    title: active ? `${categoryLabel(active)} work` : "Work",
    description,
    // Filtered views are the same page; point search engines at the index.
    alternates: { canonical: "/work" },
    openGraph: {
      title: "Work — Motion Imprints",
      description,
      images: defaultOgImages,
    },
  };
}

export default async function WorkPage({ searchParams }: Props) {
  const { category } = await searchParams;
  const active = isCategory(category) ? category : null;
  const shown = active
    ? workItems.filter((w) => w.category === active)
    : workItems;

  const filters = [
    { id: null, label: "All", count: workItems.length },
    ...workCategories.map((c) => ({
      id: c.id,
      label: c.label,
      count: workItems.filter((w) => w.category === c.id).length,
    })),
  ];

  return (
    <>
      <header className="page-head container">
        <Breadcrumbs items={[{ label: "Work" }]} />
        <div className="page-head__grid">
          <h1 className="display page-head__title">Work</h1>
          <p className="lede">
            Signs, interiors, print, packaging and merchandise, photographed in
            the workshop and on site.
          </p>
        </div>
      </header>

      {active ? null : (
        <section
          className="container projects"
          aria-labelledby="projects-title"
        >
          <div className="section-intro section-intro--split">
            <div>
              <p className="eyebrow">Projects</p>
              <h2 id="projects-title" className="display">
                One brand, several pieces
              </h2>
            </div>
            <p className="section-intro__aside">
              Brands that appear on several different pieces in our archive.
            </p>
          </div>
          <ul className="projects__list">
            {collections.map((c) => {
              const items = collectionItems(c.slug);
              return (
                <li key={c.slug}>
                  <Link className="project-card" href={`/work/${c.slug}`}>
                    <div className="project-card__frame">
                      <Picture
                        frame={items[0].frame}
                        sizes="(min-width: 1025px) 24vw, (min-width: 701px) 46vw, 80vw"
                      />
                    </div>
                    <span className="project-card__name">{c.name}</span>
                    <span className="project-card__meta">
                      {items.length} pieces <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="container work-index" aria-labelledby="all-title">
        <h2 id="all-title" className="visually-hidden">
          {active ? `${categoryLabel(active)} work` : "All work"}
        </h2>
        <nav className="work-filters" aria-label="Filter work by category">
          <ul>
            {filters.map((f) => {
              const current = f.id === active;
              return (
                <li key={f.label}>
                  <Link
                    href={f.id ? `/work?category=${f.id}` : "/work"}
                    aria-current={current ? "page" : undefined}
                    scroll={false}
                  >
                    {f.label}{" "}
                    <span className="work-filters__count">{f.count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <p className="work-index__status" role="status">
          {shown.length === 1 ? "1 piece" : `${shown.length} pieces`}
          {active ? ` in ${categoryLabel(active)}` : ""}
        </p>

        {shown.length ? (
          <div className="work-grid">
            {shown.map((item) => (
              <WorkTile
                key={item.slug}
                item={item}
                allowWide
                sizes="(min-width: 1025px) 31vw, 46vw"
              />
            ))}
          </div>
        ) : (
          <div className="work-empty">
            <p>No pieces in this category yet.</p>
            <Link className="textlink" href="/work">
              Show all work <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      </section>

      <CtaBand
        title="Want something like this?"
        text="Point us to a piece you like and tell us what you need. We will take it from there."
        secondary={{ href: "/services", label: "Browse Services" }}
      />
    </>
  );
}
