import categoryPrinting from '../../assets/photos/category-printing.jpg'
import categoryPromotional from '../../assets/photos/category-promotional.jpg'
import categoryApparel from '../../assets/photos/category-apparel.jpg'

/* Temporary licensed photography.
 *
 * Licence, creator and verification date for every file are recorded in
 * `src/assets/photos/SOURCES.md`. All are Unsplash License (free, commercial use
 * permitted, no attribution required), verified on each asset's own page rather
 * than on a search-results page — search pages mix free and paid Unsplash+ tiers
 * with no visible distinction, and several candidates failed that check.
 *
 * These occupy the hero and two category tiles only. They must never reach
 * `/work`, project pages, product detail or product catalogue cards, because
 * those placements assert that Motion completed the work or sells that exact
 * item. Categories with no verified photograph keep a designed specimen instead
 * of borrowing an unrelated one.
 *
 * Alt text is factual and illustrative. None of it claims to show Motion's work.
 */

/* There is deliberately no hero image, and therefore no HERO_PLACEHOLDER export.
 *
 * Four heroes were tried and rejected on screen: a type specimen that read as a
 * foundry sample, a wide-format printer whose hot pink and cyan fought the
 * palette, a hand-pulled screen print, and a process-colour guide. The last was
 * the best of them and still lost — it made the fold tall, opened the page with
 * a large field of blue, and pushed category discovery below the viewport.
 *
 * The homepage hero is now text only. Do not reintroduce an image, specimen,
 * mockup, gradient or abstract visual here without an explicit decision from the
 * owner; `tests/pages.test.jsx` fails if one appears. The CMS hero image field
 * still exists in the schema, but nothing renders it. */

const CATEGORY_PLACEHOLDERS = {
  printing: {
    src: categoryPrinting,
    alt: 'Illustrative wide-format printing equipment with printed media on the roll',
  },
  'promotional-display': {
    src: categoryPromotional,
    alt: 'Illustrative wide-format printer producing a large banner',
  },
  apparel: {
    src: categoryApparel,
    alt: 'Illustrative screen-printing frame being pulled by hand in a workshop',
  },
}

/* Owner-supplied category tiles, dropped into `src/assets/categories/`.
 *
 * Matched by filename against the category slug — `apparel.jpg` fills Apparel —
 * so adding one is a file copy, not a code change. That matters because these
 * are chosen by Motion while real CMS imagery is still being prepared, and
 * nobody should need to touch a module to swap a picture.
 *
 * `eager` resolves each match to its final hashed URL at build time, so the
 * lookup below is a plain map read with no dynamic import at runtime. Vite
 * evaluates the pattern statically, which is why it is written as a literal.
 * See `src/assets/categories/README.md` for the naming table. */
const ownerFiles = import.meta.glob('../../assets/categories/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  import: 'default',
})

const ownerImages = new Map(
  Object.entries(ownerFiles).map(([path, src]) => [
    // "…/categories/Promotional-Display.JPG" -> "promotional-display"
    path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '').toLowerCase(),
    src,
  ]),
)

/**
 * Resolves the image for a category tile, highest priority first:
 *
 *   1. a real image on the category record (CMS / object storage)
 *   2. an owner-supplied file in `src/assets/categories/`
 *   3. a verified licensed placeholder
 *   4. null — the tile draws a designed specimen instead
 *
 * Nothing here needs removing when real photography lands; each layer simply
 * stops being reached.
 *
 * @returns {{src: string, alt: string, isPlaceholder: boolean}|null}
 */
export function resolveCategoryImage(category) {
  if (category?.image) {
    return { src: category.image, alt: category.name, isPlaceholder: false }
  }

  const slug = category?.slug
  const owned = slug ? ownerImages.get(slug) : undefined
  if (owned) {
    /* Not flagged as a placeholder: this is Motion's own selection rather than
       stock standing in for it. The alt stays the plain category name — a tile
       is a route into a category, and must not read as a finished project. */
    return { src: owned, alt: category.name, isPlaceholder: false }
  }

  const placeholder = CATEGORY_PLACEHOLDERS[slug]
  return placeholder ? { ...placeholder, isPlaceholder: true } : null
}
