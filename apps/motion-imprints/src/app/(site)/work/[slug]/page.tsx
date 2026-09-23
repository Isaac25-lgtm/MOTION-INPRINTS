import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CtaBand } from "@/components/CtaBand";
import { WorkTile } from "@/components/work/WorkTile";
import {
  categoryLabel,
  collectionItems,
  collections,
  getCollection,
} from "@/content/work";
import { getService } from "@/lib/nav";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return collections.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) return {};
  const [first] = collectionItems(collection.slug);
  return {
    title: collection.name,
    description: collection.summary,
    alternates: { canonical: `/work/${collection.slug}` },
    openGraph: {
      title: `${collection.name} — Motion Imprints`,
      description: collection.summary,
      images: [
        {
          url: `${first.frame.base}-${first.frame.widths[0]}.webp`,
          width: first.frame.width,
          height: first.frame.height,
          alt: first.frame.alt,
        },
      ],
    },
  };
}

/**
 * A neutral gallery for a brand with several genuine pieces. No narrative,
 * scope, date or result is claimed: only what the photographs show.
 */
export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) notFound();

  const items = collectionItems(collection.slug);
  const categories = [...new Set(items.map((i) => i.category))];
  const services = collection.services
    .map((s) => getService(s))
    .filter((s) => s !== null);

  return (
    <>
      <header className="page-head container">
        <Breadcrumbs
          items={[{ href: "/work", label: "Work" }, { label: collection.name }]}
        />
        <div className="page-head__grid">
          <div>
            <p className="eyebrow">Project</p>
            <h1 className="display page-head__title">{collection.name}</h1>
          </div>
          <div>
            <p className="lede">{collection.summary}</p>
            <ul className="tags page-head__tags">
              {categories.map((c) => (
                <li key={c}>{categoryLabel(c)}</li>
              ))}
            </ul>
          </div>
        </div>
      </header>

      <section className="container collection" aria-label="Pieces">
        <div className="work-grid work-grid--gallery">
          {items.map((item) => (
            <WorkTile
              key={item.slug}
              item={item}
              linkCollection={false}
              sizes="(min-width: 1025px) 45vw, 92vw"
            />
          ))}
        </div>
      </section>

      <nav className="container svc-related" aria-labelledby="related-title">
        <h2 id="related-title" className="eyebrow">
          Services involved in pieces like these
        </h2>
        <ul>
          {services.map((r) => (
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

      <CtaBand
        title="Need pieces that work together?"
        text="Tell us which items your brand needs and we will plan them as one set."
        secondary={{ href: "/work", label: "Back to All Work" }}
      />
    </>
  );
}
