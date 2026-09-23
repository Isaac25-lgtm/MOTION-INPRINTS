import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href: string;
  children: ReactNode;
  variant?: "solid" | "ghost" | "text";
  external?: boolean;
};

export function ButtonLink({
  href,
  children,
  variant = "solid",
  external = false,
}: Props) {
  const className = `btn btn--${variant}`;

  if (external) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}
