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
2. **Hierarchy comes from weight, width, colour and placement**, not from increasing size. The display style uses Archivo's width axis rather than a larger font size.
3. **Blue is an accent, never a surface.** Sections alternate white and warm off-white, with the occasional near-black band. Large blue fields are prohibited.
4. **Motion is a few percent.** Images scale to 1.03, underlines travel, arrows shift 3–4px. Nothing lifts, glows, spins or bounces.

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

**Contrast matters here.** The brand blue measures **4.3:1 on white** — enough for large text, borders, icons and focus rings (which need 3:1), but short of the 4.5:1 required for body-size text. So small accent text uses `--blue-text` (`#14547a`, 5.9:1), and inverse sections swap to `--blue-500`. The brand colour never costs legibility, and `--text-accent` resolves correctly in both contexts without any call site thinking about it.

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
