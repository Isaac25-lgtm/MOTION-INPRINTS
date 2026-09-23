import type { CSSProperties } from "react";
import type { Img as ImgData } from "@/content/media";

type Props = {
  img: ImgData;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** CSS object-position, e.g. "50% 30%". */
  position?: string;
  /** Hide from assistive technology when the image is purely decorative. */
  decorative?: boolean;
};

const set = (img: ImgData, ext: string) =>
  img.widths.map((w) => `${img.base}-${w}.${ext} ${w}w`).join(", ");

/** AVIF/WebP picture with explicit dimensions and lazy loading. */
export function Img({
  img,
  sizes,
  priority = false,
  className,
  position,
  decorative = false,
}: Props) {
  const smallest = Math.min(...img.widths);
  return (
    <picture
      className={`media ${className ?? ""}`.trim()}
      style={position ? ({ "--pos": position } as CSSProperties) : undefined}
    >
      <source type="image/avif" srcSet={set(img, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={set(img, "webp")} sizes={sizes} />
      <img
        src={`${img.base}-${smallest}.webp`}
        alt={decorative ? "" : img.alt}
        width={img.width}
        height={img.height}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding={priority ? "sync" : "async"}
      />
    </picture>
  );
}
