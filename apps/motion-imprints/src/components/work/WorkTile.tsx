import Link from "next/link";
import { Picture } from "@/components/media/Picture";
import { categoryLabel, getCollection, type WorkItem } from "@/content/work";

type Props = {
  item: WorkItem;
  sizes: string;
  /** Link the tile to its project page when it belongs to a collection. */
  linkCollection?: boolean;
  /** Let very wide photographs span two grid columns instead of cropping. */
  allowWide?: boolean;
};

/** A genuine work photograph in a fixed-ratio frame, so the grid never shifts. */
export function WorkTile({
  item,
  sizes,
  linkCollection = true,
  allowWide = false,
}: Props) {
  const wide = allowWide && item.frame.width / item.frame.height >= 1.6;
  const frame = (
    <div className="work-tile__frame">
      <Picture frame={item.frame} sizes={sizes} />
    </div>
  );
  const collection =
    linkCollection && item.collection ? getCollection(item.collection) : null;

  if (collection) {
    return (
      <Link
        className={`work-tile work-tile--link${wide ? " work-tile--wide" : ""}`}
        href={`/work/${collection.slug}`}
      >
        {frame}
        <span className="work-tile__caption">
          <span className="work-tile__title">{item.title}</span>
          <span className="work-tile__meta">
            {collection.name} <span aria-hidden="true">→</span>
          </span>
        </span>
      </Link>
    );
  }
  return (
    <figure className={`work-tile${wide ? " work-tile--wide" : ""}`}>
      {frame}
      <figcaption className="work-tile__caption">
        <span className="work-tile__title">{item.title}</span>
        <span className="work-tile__meta">{categoryLabel(item.category)}</span>
      </figcaption>
    </figure>
  );
}
