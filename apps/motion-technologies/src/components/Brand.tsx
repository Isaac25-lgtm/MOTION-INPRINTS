import Image from "next/image";
import Link from "next/link";

/**
 * The Technologies lockup: the supplied "Motion i" wordmark, unchanged, with
 * "SYSTEMS . DATA . DIGITAL" in place of the print tagline (OD-07), and a
 * "Technologies" label beside it. The "i" mark is never isolated.
 */
export function Brand({ priority = false }: { priority?: boolean }) {
  return (
    <Link
      href="/"
      className="brand"
      aria-label="Motion Imprints Technologies home"
    >
      <Image
        src="/brand/logo-technologies.png"
        alt=""
        width={1466}
        height={596}
        priority={priority}
      />
      <span className="brand__label" aria-hidden="true">
        Technologies
      </span>
    </Link>
  );
}
