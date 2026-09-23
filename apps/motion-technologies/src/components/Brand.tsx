import Image from "next/image";
import Link from "next/link";

/**
 * The supplied Motion Imprints lockup, unchanged, with a "Technologies" label
 * beside it. The "i" mark is never isolated (owner approval required).
 */
export function Brand({ priority = false }: { priority?: boolean }) {
  return (
    <Link
      href="/"
      className="brand"
      aria-label="Motion Imprints Technologies home"
    >
      <Image
        src="/brand/logo-trim.png"
        alt=""
        width={1466}
        height={596}
        priority={priority}
      />
      <span className="brand__division" aria-hidden="true">
        Technologies
      </span>
    </Link>
  );
}
