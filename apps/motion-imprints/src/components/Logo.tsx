import Image from "next/image";
import Link from "next/link";

type Props = {
  priority?: boolean;
  /** Footer places the logo on a paper plate: the supplied lockup has a black
   *  tagline that would disappear on the dark footer. */
  variant?: "header" | "footer";
};

export function Logo({ priority = false, variant = "header" }: Props) {
  return (
    <Link
      href="/"
      className={`brand-logo${variant === "footer" ? " brand-logo--footer" : ""}`}
      aria-label="Motion Imprints home"
    >
      <Image
        src="/brand/logo-trim.png"
        alt="Motion Imprints"
        width={1466}
        height={596}
        priority={priority}
      />
    </Link>
  );
}
