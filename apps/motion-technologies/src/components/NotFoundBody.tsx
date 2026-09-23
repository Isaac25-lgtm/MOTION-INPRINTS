import Link from "next/link";

/** Shared 404 content for the route-group and root not-found boundaries. */
export function NotFoundBody() {
  return (
    <div className="container confirm">
      <p className="kicker">404</p>
      <h1 className="plain__title">This page is not here</h1>
      <p className="lede">
        The address may have changed. The solutions page lists everything we
        build.
      </p>
      <div className="actions" style={{ marginTop: 24 }}>
        <Link className="btn btn--dark" href="/solutions">
          See All Solutions
        </Link>
        <Link className="btn btn--line-dark" href="/">
          Go to the Homepage
        </Link>
      </div>
    </div>
  );
}
