# Motion design system

The visual language for **Motion — Design · Print · Brand**, Kampala.

Everything visual is defined in `src/styles/tokens.css`. No component may hard-code a colour, size, radius or duration.

| File | Holds |
| --- | --- |
| `styles/tokens.css` | Colour, type scale, spacing, layout, border/radius/shadow, motion |
| `styles/base.css` | Element defaults, focus treatment, type classes (`.t-*`) |
| `styles/layout.css` | Containers, sections, grids, editorial splits |
| `styles/components.css` | Buttons, forms, cards, overlays, states |
| `styles/site.css` | Header, footer, navigation, page compositions |

## Art direction

Motion is a production company. The interface is the gallery wall, not the exhibit: restrained, sharply set, and built to make photographs of real signage, print and apparel look expensive. The reference points are a premium print studio, an independent creative agency, a high-end product catalogue and an editorial portfolio — never a SaaS landing page.

Four rules carry most of the weight:

1. **Not everything is a card.** Spacing and a single hairline separate content before any container does. A product is an image, a name, a descriptor and a price — with no box around it.
2. **Hierarchy comes from weight, width, colour and placement**, not from increasing size. The display style uses Archivo's width axis rather than a larger font size, and caps at 3.5rem.
3. **Brand blue is an accent and a rare structural emphasis — not a recurring surface rule.** The work and photography should eventually carry most of the colour. White and warm off-white carry the page.
4. **Motion is a few percent.** Images scale to 1.03, underlines travel, arrows shift 3–4px. Nothing lifts, glows, spins or bounces.

### Correction, and why it matters

The first build followed rule 3 in the opposite direction — blue was confined to the logo, a focus ring and one eyebrow, and the display clamped to **6rem**. The result was a page that opened with three enormous black words filling the viewport, then a large grey hatched placeholder, with essentially no colour anywhere. It read as a blank document, not as a print company.

Two lessons are now encoded in the system:

- **Restraint needs something to restrain.** The original reasoning — "the work supplies the colour, the interface frames it" — only holds once photography exists. With no images, an interface that contributes nothing has nothing to frame. The design must stand up empty, because that is the state it launches in.
- **A placeholder must recede.** The hatched grey block was deliberately unattractive so it could not be mistaken for real work. Correct in principle, but at full width it became the loudest element on the page. It is now a flat brand tint: still unmistakably not a photograph, no longer the focus.

`tests/pages.test.jsx` pins these corrections — it fails if the display cap rises above 3.5rem, if more than one saturated band appears in the page body, or if pale blue starts recurring as a background.

## Section bands

Target mix, by page area:

- **~80%** white and warm off-white
- **~15%** quiet pale-blue wash, or blue detail (rules, eyebrows, links, buttons)
- **~5%** saturated or deep brand blue

| Class | Surface | Used for |
| --- | --- | --- |
| *(none)* | White | Most sections |
| `.section--alt` | Warm off-white | Selected work, custom work, page-closing CTAs |
| `.section--soft` | Pale blue wash | Process — used sparingly |
| `.section--brand-deep` | Deep blue | Digital solutions, and the footer |
| `.section--brand` | Full brand blue | Available, currently unused in the body |
| `.section--inverse` | Near-black | Reserved |

### The governing rule

> **Brand blue is an accent and a rare structural emphasis. Repetition of calm white or warm-paper surfaces is allowed and often desirable. A saturated or deep-blue section must mark a genuine change in hierarchy.**

There is exactly one saturated band in the whole site body — Digital Solutions — plus the footer. Two saturated bands may never sit adjacent, and pale blue is a sparing accent surface rather than a second recurring background.

Homepage order: white hero → white categories → warm Selected Work → white products → warm Custom Work → **deep-blue Digital Solutions** → warm process → white contact → deep-blue footer.

Emphasis without a coloured field: a marked eyebrow (`.t-eyebrow--accent`), a short blue rule (`.accent-rule`), the accent button, and layout weight. That is how Custom Work is emphasised — it was a full blue band, which put two saturated sections in a row and turned colour into a layout habit.

Each band remaps `--text`, `--text-muted`, `--border` and the action tokens, so a button or empty state inside one adapts without knowing where it sits. No component contains a colour conditional.

### The rule that was removed, and must not return

An earlier revision enforced *"no two consecutive sections may share a background."*

It is mechanical. It forces alternation, and alternation with a short palette means reaching for blue constantly — which is precisely how the page ended up with a pale-blue category band, a blue Custom Work band above a deep-blue Digital Solutions band, a pale-blue process band and a blue footer. Colour became a layout habit rather than a signal.

It is gone, along with the test that enforced it. **Two adjacent white or warm bands are a valid, calm result.** The replacement tests enforce discipline rather than alternation: at most one saturated body band, never two adjacent, pale blue at most once, and quiet surfaces in the majority.

## The homepage hero carries no image

Text only, by explicit art direction. Four treatments were tried and rejected on screen — a type specimen, a wide-format printer, a hand-pulled screen print, and a process-colour guide. The last was the best of them and still lost: it made the fold tall, opened the page with a large field of blue, and pushed category discovery below the first viewport.

The hero is now a compact centred masthead: eyebrow, `Design. / Print. / Brand.` at the 3.5rem cap, a short blue rule, one factual sentence and two actions. Blue appears only as the eyebrow, the rule, the primary action and the focus ring.

**Do not add an image, specimen, mockup, gradient or abstract visual here** without an explicit decision from the owner. `tests/pages.test.jsx` fails if one appears. The CMS hero image field remains in the schema but nothing renders it.

## Temporary photography

Three category tiles carry licensed placeholder photographs as a fallback. Licence, creator, source page and verification date for each are in `src/assets/photos/SOURCES.md`, along with the candidates that were rejected and why.

Owner-supplied files in `src/assets/categories/` take precedence over them, matched by filename against the category slug — see the README beside them.

Rules, enforced by test:

- Verified on each asset's own page, not a search page — search results mix free and paid Unsplash+ tiers with no visible distinction, and four of nine candidates failed.
- Downloaded into the repository, never hotlinked.
- Alt text is factual and illustrative — "Illustrative wide-format printer running banner material", never "Motion project".
- **Never** in `/work`, project pages, product detail or product cards. Those placements assert Motion did the work or sells that item.
- Categories with no verified photograph keep a designed specimen rather than borrowing an unrelated image.

A real CMS image or `category.image` overrides these with no code change.

## Brand colour

Extracted from the supplied `motion logo.pdf`, which stores the artwork as an indexed-CMYK image. Its palette holds exactly three entries, so the blue is read directly rather than estimated:

| | Value | Use |
| --- | --- | --- |
| **CMYK** | **82.7 / 38.4 / 11.0 / 0** | The ink values in the supplied artwork. Give these to a printer. |
| sRGB | `#1f80b9` | `--motion-blue-source` |

**Extraction record** — reproducible from the PDF:

- Colour space object: `[/Indexed /DeviceCMYK 2 9 0 R]` — indexed, 3 entries (`hival` 2).
- Palette stream (object 9), raw bytes: `211 98 28 0 | 191 173 171 230 | 0 0 0 0`.
- Entry 0 ÷ 255 → C 0.827, M 0.384, Y 0.110, K 0 → the brand blue. Entry 1 is the near-black strapline, entry 2 white.

Two caveats, stated plainly. The CMYK is exactly what the supplied file contains, but **whether that file is Motion's official brand specification is unverified** — confirm with the original designer before using it for print. And `#1f80b9` is one sRGB rendering of those inks; a different CMYK profile will shift it slightly. Re-profile `--motion-blue-source` if a colour-managed conversion is available.

**Contrast matters here.** The brand blue measures **4.3:1 on white** — enough for large text, borders, icons and focus rings (which need 3:1), but short of the 4.5:1 required for body-size text. So small accent text uses `--blue-text` (`#14547a`, 5.9:1), and dark or brand bands swap to `--blue-400` / `--blue-500`. The brand colour never costs legibility, and `--text-accent` resolves correctly in every context without any call site thinking about it.

White text on `--blue-600` measures 4.4:1 — used only at `--size-body-lg` and above on brand bands, where 3:1 is the requirement. Body-size text on a brand band uses `--on-brand-muted`, and the deeper `--blue-800` band carries white at 9.8:1.

The ramp runs `--blue-050` through `--blue-900` so a band, its text, its borders and its buttons can all be drawn from one hue.

Change `--motion-blue-source` only if the sRGB rendering is re-profiled; the ramp derives from it. Do not introduce blues anywhere else.

The palette is otherwise deliberately short: near-black text, a warm off-white for alternating bands, four greys, and semantic colours used only for state. No secondary brand colour has been invented.

## Logo

`src/assets/` holds the logo reconstructed from the supplied PDF — the badge's white-to-blue gradient lives in the artwork's soft mask, so this is the original artwork rather than a redraw.

| Asset | Crop | Used by |
| --- | --- | --- |
| `motion-wordmark.png` | "Motion" + badge | Header — at 32–36px tall the strapline would be ~6px and illegible, so it is set as live text beside the mark |
| `motion-logo.png` | Full lockup with DESIGN · PRINT · BRAND | Footer, where there is room to read it |
| `public/favicon.png` | Badge only | Browser tab and home screen |

All three carry transparency and are intended for **light backgrounds**. A knockout version is still needed before the logo is placed on a dark ground.

## Typography

**Archivo** (variable, width 62–125, weight 400–700) sets the entire interface — a sturdy commercial grotesque that reads as signage lettering rather than startup UI. **Newsreader** (variable) is reserved for project captions and pull quotes via `.t-editorial`.

Two families, loaded as variable fonts from Google Fonts with `display=swap` and preconnect. For production, subset and self-host the two woff2 files and drop the third-party requests — the stacks in `--font-sans` / `--font-serif` already carry sensible fallbacks.

Styles: `.t-display`, `.t-h1`–`.t-h4`, `.t-eyebrow`, `.t-body-lg`, `.t-body`, `.t-body-sm`, `.t-caption`, `.t-editorial`, `.t-nav`, `.t-price`, `.t-meta`, `.t-label`.

Prices use tabular figures so listing columns align. Eyebrows carry section identity, which is what lets headings stay modest.

## Layout

Containers: `--container` 78rem standard, `--container-narrow` 46rem for prose, `--container-wide` 96rem for media. `.bleed` escapes to the viewport edge for installation photography.

Grids: `.grid--products` (2 → 3 → 4), `.grid--categories` (2 → 3), `.grid--pair`, `.grid--trio`, `.split` (5fr/7fr, weighted rather than halved), `.feature-row` (3fr/2fr for one large project beside smaller ones). `.offset-start` / `.offset-end` provide controlled asymmetry that collapses on small screens.

Product grids stay **two-up on phones** so a catalogue still reads as a catalogue.

Vertical rhythm is `--section-gap`, and full-bleed imagery is expected to break it.

## Borders, radius, shadow

One hairline (`1px`, `--border`). Radii are 2–3px — fabricated and printed work has real edges, and large radii are the fastest way to read as a template. `--radius-full` exists only for genuinely circular controls such as the cart count.

**There is exactly one shadow**, `--shadow-overlay`, used only by drawers and toasts — things that genuinely float. Cards, buttons and images never carry shadow.

## Motion

`--duration` 220ms on `--ease`. Permitted: image scale to `--hover-image-scale` (1.03), underline scale-in, opacity shift, ≤4px translation, arrow travel. Prohibited: lifting, glow, rotation, bounce, parallax for decoration, animated gradients.

`prefers-reduced-motion: reduce` collapses every duration to 1ms and sets the hover scale to 1 at the token level, so it applies everywhere at once.

## Accessibility

A single focus treatment (`2px` brand outline, `2px` offset) applies site-wide and is never removed. Interactive targets are ≥44px. Body text is 16px minimum. Placeholder media carries real alternative text. Skip link included.

## Placeholder media

`.frame--placeholder` renders a hatched, dashed, labelled block. It is intentionally unattractive: development media must never be mistaken for Motion's work, and no fabricated product photography exists anywhere in this system.

## Style preview

`/internal/style-preview` renders the full system. It is registered **only when `import.meta.env.DEV` is true**, so it does not exist in the production bundle and cannot be reached on Render.
