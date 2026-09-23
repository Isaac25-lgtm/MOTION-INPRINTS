import Link from "next/link";

export type Crumb = { href?: string; label: string };

/** Breadcrumb trail. The last crumb is the current page and is not a link. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <Link href="/">Home</Link>
        </li>
        {items.map((item, i) =>
          item.href && i < items.length - 1 ? (
            <li key={item.label}>
              <Link href={item.href}>{item.label}</Link>
            </li>
          ) : (
            <li key={item.label} aria-current="page">
              {item.label}
            </li>
          ),
        )}
      </ol>
    </nav>
  );
}
