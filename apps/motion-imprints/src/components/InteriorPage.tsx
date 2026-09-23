import type { ReactNode } from "react";
import { ButtonLink } from "./ButtonLink";

type Props = {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
  showCta?: boolean;
};

export function InteriorPage({
  eyebrow = "Motion Imprints",
  title,
  children,
  ctaHref = "/contact",
  ctaLabel = "Start a project",
  showCta = true,
}: Props) {
  return (
    <article className="interior">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="display">{title}</h1>
      <div className="interior__body">{children}</div>
      {showCta ? <ButtonLink href={ctaHref}>{ctaLabel}</ButtonLink> : null}
    </article>
  );
}
