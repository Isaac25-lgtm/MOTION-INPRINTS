# Photography and media art direction

The site is image-led. Its quality depends almost entirely on the quality of Motion's own photography.

## Source priority

1. **Original high-resolution photographs supplied by Motion.** The only source that produces the intended result.
2. **Owner-uploaded project photography** through the admin area, which becomes the authoritative portfolio source.
3. **Genuine Motion work previously published on its own channels** — only where rights and quality allow, and preferably re-sourced from the originals rather than re-saved from a social post. Social exports are recompressed, cropped to the platform's ratios and stripped of resolution; they will look worse than everything around them.
4. **Neutral development placeholders** — the current state.

**No fabricated photography exists in this repository**, and none may be added. Generated or stock imagery must never be presented as Motion's work, and the portfolio must never be padded with unrelated stock.

## The placeholder is deliberately unattractive

`Frame` renders a hatched, dashed, labelled block whenever no source is supplied (`.frame--placeholder`). It is plain on purpose: development media must be impossible to mistake for finished work, and an attractive placeholder invites exactly that mistake.

Each placeholder carries a specific label — "Hero photograph pending", "Project photograph pending", "Product photograph pending" — and its `alt` text, so screen readers get the same information sighted users do.

## Every image goes through `Frame`

`src/components/ui/Media.jsx` is the only place an `<img>` is written. It fixes:

- **Aspect ratio** — `square`, `portrait`, `landscape`, `wide`, `tall`. Ratio is reserved before load, so nothing shifts as images arrive.
- **Loading** — `loading="lazy"` and `decoding="async"` everywhere except `priority`, which is reserved for the one hero image per page and switches to `eager` / `fetchPriority="high"` / `decoding="sync"`.
- **`sizes`** — every call site passes a real `sizes` string matching its grid, so browsers can select correctly from a `srcSet`.
- **Hover** — `1.03` scale on the image inside a fixed frame, so the edge stays crisp and layout never moves. Disabled entirely under `prefers-reduced-motion`.

## Treatments

| Context | Ratio | Notes |
| --- | --- | --- |
| Homepage hero | 4:5 → 16:10 → 16:9 | Only preloaded image on the page. Portrait crop on phones so a vertical screen is filled rather than letterboxed. |
| Product thumbnail | 1:1 | Consistent square keeps catalogue rows aligned. |
| Product gallery | 1:1 | Detail view, not preloaded below the first image. |
| Portfolio hero | 16:9 | Full container width; `sharp` (radius 0) when full-bleed. |
| Project detail | 4:3 and 16:9 | Composition varies with how many photographs exist — see below. |
| Full-width | 16:9, `.bleed` | Escapes the container for installation shots. |
| Image pair | 4:3 each | Two equal columns, stacking on phones. |
| Editorial trio | 3:4 each | The middle image drops by one space step, so the row reads as a composition rather than three equal thirds. |
| Mobile crops | Portrait preferred | Wide crops of tall subjects (signage, pylons, pull-ups) waste a phone screen. |

## What is prohibited

- Rounded corners beyond the 2–3px system radius. Fabricated and printed work has real edges.
- Gradients applied over photographs.
- Blanket dark overlays. Contrast is achieved by setting text **beneath** an image, not across it — which is why every caption in this build sits outside its frame.
- Text placed over photography where legibility depends on what the photograph happens to contain.

## Portfolio composition

`WorkPage` varies layout by position on a six-column bed rather than repeating one card: a full-width lead, then paired items, a two-thirds item, a portrait third. A full-width item following smaller ones gains extra space above it, so the rhythm breaks deliberately rather than looking like a spacing error.

Project detail pages adapt to their media — one photograph runs full-bleed, two become a pair, further images become captioned figures. Projects do not share one template.

## When real photography arrives

1. Supply originals at 2400px on the long edge or larger.
2. Export `webp` (and `avif` where available) with `jpeg` fallbacks, at roughly 1×/2× the rendered widths implied by each `sizes` string above.
3. Populate `media_assets` and the `product_media` / `project_media` link tables; the API already returns the first public image per record.
4. Set `OBJECT_STORAGE_PUBLIC_BASE_URL` so keys resolve to URLs. Until it is set, `image` is `null` and placeholders show — by design, never a broken image.
5. Write real `alt` text describing the work, not the file name.
