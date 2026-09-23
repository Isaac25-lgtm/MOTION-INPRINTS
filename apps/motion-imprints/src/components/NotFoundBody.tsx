import { ButtonLink } from "@/components/ButtonLink";

/** Shared 404 content for the route-group and root not-found boundaries. */
export function NotFoundBody() {
  return (
    <article className="interior">
      <p className="eyebrow">404</p>
      <h1 className="display">This page is not here</h1>
      <div className="interior__body">
        <p>The address may have changed, or the page has not been built yet.</p>
      </div>
      <ButtonLink href="/">Back to Motion Imprints</ButtonLink>
    </article>
  );
}
