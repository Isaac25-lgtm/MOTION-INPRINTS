"use client";

import Link from "next/link";
import { useQuoteList } from "./store";

/** Header link to the quote list, with the number of items once there are any. */
export function QuoteLink() {
  const lines = useQuoteList();
  const count = lines.length;
  return (
    <Link className="quote-link" href="/quote">
      Quote
      {count > 0 ? (
        <span className="quote-link__count">
          {count}
          <span className="visually-hidden">
            {count === 1 ? " item" : " items"}
          </span>
        </span>
      ) : null}
    </Link>
  );
}
