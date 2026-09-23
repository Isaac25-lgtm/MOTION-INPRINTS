"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Recoverable error state for any page in the site shell. */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest links this to the server log without exposing details.
    console.error("page error", error.digest ?? "");
  }, [error]);

  return (
    <article className="interior">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="display">This page did not load</h1>
      <div className="interior__body">
        <p>
          Please try again. If it keeps happening, the rest of the site is still
          available.
        </p>
      </div>
      <div className="actions">
        <button className="btn btn--solid" type="button" onClick={reset}>
          Try Again
        </button>
        <Link className="btn btn--ghost" href="/">
          Go to the Homepage
        </Link>
      </div>
    </article>
  );
}
