import data from "./tech-media.json";

/**
 * Technologies media, built by scripts/build-tech-assets.py.
 *
 * photos   licensed Pexels photography (atmosphere, never presented as our
 *          clients or our staff)
 * devices  licensed device photographs with our own interface designs on the
 *          screen; every value on those screens is invented sample data
 * videos   licensed Pexels footage for the homepage hero
 */

export type Img = {
  base: string;
  widths: number[];
  width: number;
  height: number;
  alt: string;
};

type Entry = Img & { source: string };

const photos = data.photos as Record<string, Entry>;
const devices = data.devices as Record<string, Entry>;

export function photo(slug: string): Img {
  const found = photos[slug];
  if (!found) throw new Error(`photo ${slug} missing`);
  return found;
}

export function device(slug: string): Img {
  const found = devices[slug];
  if (!found) throw new Error(`device ${slug} missing`);
  return found;
}

export const heroVideo = data.videos as Record<
  "hero-wide" | "hero-tall",
  {
    src: string;
    width: number;
    height: number;
    poster: { base: string; widths: number[] };
  }
>;
