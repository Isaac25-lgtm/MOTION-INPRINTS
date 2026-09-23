import type { CSSProperties } from "react";

export type Frame = {
  /** Path without the width suffix, e.g. /media/home/work/halo-sign */
  base: string;
  widths: readonly number[];
  width: number;
  height: number;
  alt: string;
  position?: string;
};

function srcSet(frame: Frame, ext: "avif" | "webp") {
  return frame.widths.map((w) => `${frame.base}-${w}.${ext} ${w}w`).join(", ");
}

type Props = {
  frame: Frame;
  sizes: string;
  priority?: boolean;
  /** Optional art-directed frame for narrow screens (max-width: 700px). */
  narrow?: Frame;
  className?: string;
};

/** One AVIF/WebP picture with explicit dimensions and lazy loading. */
export function Picture({
  frame,
  sizes,
  priority = false,
  narrow,
  className,
}: Props) {
  const smallest = Math.min(...frame.widths);
  const style: CSSProperties | undefined = frame.position
    ? ({ "--pos": frame.position } as CSSProperties)
    : undefined;
  return (
    <picture className={`home-media ${className ?? ""}`.trim()} style={style}>
      {narrow ? (
        <>
          <source
            media="(max-width: 700px)"
            type="image/avif"
            srcSet={srcSet(narrow, "avif")}
            sizes="100vw"
          />
          <source
            media="(max-width: 700px)"
            type="image/webp"
            srcSet={srcSet(narrow, "webp")}
            sizes="100vw"
          />
        </>
      ) : null}
      <source type="image/avif" srcSet={srcSet(frame, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(frame, "webp")} sizes={sizes} />
      <img
        src={`${frame.base}-${smallest}.webp`}
        alt={frame.alt}
        width={frame.width}
        height={frame.height}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding={priority ? "sync" : "async"}
      />
    </picture>
  );
}
