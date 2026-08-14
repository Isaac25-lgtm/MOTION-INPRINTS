# Visual and mobile review — Phase 3.5 / 4.7

Audit of the design system and public site. Records what was checked, what was changed, and what cannot be signed off without real photography and a device.

## The governing question

> A Kampala printing and branding company with strong creative direction, or a prompt-generated template with Motion content pasted in?

The build answers it structurally rather than decoratively:

- **Work outranks chrome.** Selected Work sits third on the homepage on a contrasting band, and the portfolio grid varies item width by position instead of repeating one card.
- **Almost nothing is a card.** Products, projects and categories are image + text separated by grid gap. Containers appear only where an overlay genuinely floats.
- **Blue is an accent.** No section takes a blue background. Blue appears in the logo mark, one eyebrow, the cart count, and focus rings.
- **Headings are modest.** Section identity comes from the eyebrow, so `h2` never needs to be enormous. One display style exists and only the hero uses it.
- **Left-aligned by default.** No two consecutive centred section headings anywhere.

## Changed during the audit

| Issue | Fix |
| --- | --- |
| Focus outline removed on the search input, leaving no visible indicator | Outline moved to `.search-field:focus-within`; the ring is never simply removed |
| Select chevron assembled from two CSS gradients | Redrawn as an inline SVG, removing gradients from the system except the placeholder hatch |
| Process step body copy landed under the step number on phones | Body forced to column 2 below 48rem |
| Digital Solutions rows squeezed a description into ~90px at 320px | `.detail-list__row--wide` stacks to two rows on phones |
| Filter and tab controls were under the 44px touch minimum | `min-height: 2.75rem` on both; filters use padding, not pills |
| Footer link lists too dense to tap reliably | `padding-block` added to link rows |
| File input clipped by the fixed control height | `min-height: 0` for `input[type=file]` |
| iOS zoomed the page on focusing a control | Controls forced to 16px below 48rem |
| A failed *related items* fetch printed an error block under project and product pages | Secondary sections pass `errorTitle={null}` and render nothing on failure |
| `Async` showed "Loading…" even when a section explicitly opted out | `skeleton={null}` now means render nothing; only an omitted prop falls back |

## Breakpoints

Layout is verified by construction at 320 / 360 / 390 / 430 / tablet / laptop / desktop / large desktop:

- Every horizontal-scrolling region (`.tabs`) contains its own overflow; the page body never scrolls sideways.
- Product grids stay **two-up at 320px** so a catalogue reads as a catalogue rather than a single-file list.
- The portfolio grid collapses to one column below 48rem — correct reading order for image-led content — and uses a six-column bed above it so items can take genuinely different widths.
- The hero image is 4:5 on phones, 16:10 at tablet, 16:9 on desktop: a tall crop fills a phone screen instead of letterboxing it.
- Editorial devices that depend on width — the trio's dropped middle image, offset columns, split asymmetry, sticky sidebars — are all gated above 48–62rem and collapse cleanly.
- The mobile menu is a composed drawer: large primary sections with travelling arrows, then account/cart/tracking, then direct contact beneath a rule.

## Enforced by test

`tests/design-system.test.js` fails the build on regression:

no decorative gradients · exactly one shadow token and no ad-hoc shadows · radii only from tokens · no emoji in source · no hard-coded colours outside `tokens.css` · reduced-motion honoured at token level · hover scale ≤ 1.05 · no focus outline removed without replacement · no fabricated business facts in page source · lazy loading and `sizes` on all media

`tests/pages.test.jsx` server-renders every public page and asserts the hero carries exactly two actions, quote-only products never show a number, a missing price never becomes zero, and placeholder media is labelled for assistive technology rather than rendering a broken image.

## Cannot be signed off yet

1. **Real photography.** The site is image-led and currently shows labelled placeholders. Its actual visual quality is unproven until Motion's originals are in place. This is the single largest open variable.
2. **Device testing.** Breakpoints are verified by construction, via the dev server and by server-rendered tests — not on physical hardware. Real-device checks remain outstanding for iOS Safari viewport and keyboard behaviour, Android Chrome, drawer scroll-locking, sticky layouts, font rendering, file inputs, touch interaction, 320px overflow and slow image loading.
3. **Populated composition.** Automated tests now cover populated grids, long names, mixed orientations and pagination at volume (see below), but nobody has *looked* at a full portfolio or a 30-product catalogue. Grid rhythm at real volume is unjudged.
4. **Owner-verified copy.** Operational wording has been reduced to what the brief supports (see below), but the About and Process copy is still written by us, not by Motion. It is CMS-overridable and should be replaced with the owner's own words.

Resolved since the first pass: the brand blue is no longer provisional — it was extracted from the supplied `motion logo.pdf` and is documented with its extraction record in `DESIGN_SYSTEM.md`.
