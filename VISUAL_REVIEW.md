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

## Second correction — over-rotation on colour

The first correction fixed "too plain" and overshot into "blue as a rule". Reviewing the built pages: a pale-blue category band, a full-blue Custom Work band **directly above** a deep-blue Digital Solutions band, another pale-blue process band, blue closing bands on Services and About sitting immediately above the blue footer, and a row of tinted chips in a hero that already had a blue eyebrow, rule and button. It read as a sequence of colour-demo panels.

The cause was a rule I had encoded and tested: *no two consecutive sections may share a background*. That forces alternation, and alternation with a small palette means reaching for blue constantly. **Removed, along with the test enforcing it.**

The replacement, now stated in `DESIGN_SYSTEM.md` and enforced in `tests/pages.test.jsx`:

> Brand blue is an accent and a rare structural emphasis. Repetition of calm white or warm-paper surfaces is allowed and often desirable. A saturated or deep-blue section must mark a genuine change in hierarchy.

Two adjacent white or warm bands are a valid, calm result and must never fail a test.

| Was | Now |
| --- | --- |
| Categories on pale blue | White |
| Custom Work on full brand blue | Warm off-white, emphasised by eyebrow, blue rule and accent button |
| Services / About closing on blue, above a blue footer | Warm off-white |
| Six tinted chips in the hero | One quiet line above a hairline |
| Footer lockup at 3.5rem on a padded white panel | 2–2.25rem, tight padding |
| Giant cropped letterforms leading every specimen | Small corner reference mark; the material cue leads |

Result: **one** saturated band in the entire site body — Digital Solutions — plus the footer. Tests now enforce that at most one exists, that two may never sit adjacent, and that quiet surfaces outnumber saturated ones.

## Third correction — the hero carries no image at all

Four hero treatments were built and rejected on screen:

| Attempt | Why it failed |
| --- | --- |
| "Aa / Specimen" type panel | Well made, but read as a type-foundry sample rather than a print company |
| Wide-format printer, banner material | Authentic but industrial; hot pink and cyan fought the palette; a third party's job across the frame |
| Hand-pulled screen print | Warmer and genuinely premium, but one trade out of seven |
| Process-colour guide | The best of the four — and still made the fold tall, opened the page with a large field of blue, and pushed category discovery below the viewport |

Underneath all four sat a structural problem: nearly every stock workshop photograph is recognisably *somewhere else* — a Paris etching studio, a Vietnamese flag workshop, a European factory with a competitor's name painted on the wall. A visibly foreign hero undercuts a Kampala company.

**The hero is now text only**: eyebrow, `Design. / Print. / Brand.` at the 3.5rem cap, a short blue rule, one factual sentence, two actions, centred. No chip row, and no service list beneath the buttons — that list duplicated the category section immediately below it.

`hero-colour.jpg` was **deleted, not parked**. A placeholder with no approved placement is exactly the asset that later drifts onto a portfolio or product surface, where it would assert work Motion did not do. It is re-downloadable from the source URL recorded in `src/assets/photos/SOURCES.md`.

Sourcing throughout was verified per-asset, not per-search-page: **four of nine Unsplash candidates were rejected** — three Unsplash+ (paid Getty tier, surfaced inside free results), one showing a third-party brand's advertisement — plus six Pexels candidates rejected for a competitor's logo on a wall, a direct-to-camera gaze that would imply endorsement, and clutter. Every candidate was downloaded and *looked at*; descriptions never surfaced the disqualifying detail.

## Fourth correction — colour rebalance

| Was | Now |
| --- | --- |
| Hero: blue photograph filling half the fold | Text only; blue is the eyebrow, rule, primary action and focus ring |
| Categories on a pale-blue band | White, tightened so the section head reaches the first viewport |
| Process on a pale-blue band directly under deep-blue Digital Solutions | Warm off-white — the page no longer closes on blue, blue, blue footer |
| Footer lockup at 2–2.25rem on a padded white panel | 1.5–1.75rem, padding trimmed to the mark |

Pale blue (`.section--soft`) is now **unused** in the page body. It remains available, and a test caps it at one occurrence so it cannot quietly become a second recurring background.

Services and About were checked: both already close on warm off-white. No full-blue section exists anywhere outside Digital Solutions and the footer.

## Redesign after first review on screen

Seeing the built site changed the assessment. The original palette — white, warm off-white, near-black, blue confined to the logo — read as a blank document rather than a print company, and the 6rem display filled the viewport with three words before any content appeared. Both were my calls, and both were wrong for a site that launches with no photography.

| Problem | Change |
| --- | --- |
| Display clamped to 6rem, consuming the fold | Capped at 3.5rem; presence comes from weight, width and colour |
| Hero stacked copy above a full-width empty frame | Side-by-side composition, so the fold carries statement, standfirst and both actions |
| No colour anywhere but the logo | Brand-blue and deep-blue bands, pale-blue washes, coloured page-head rules |
| Grey hatched placeholders dominating every page | Flat brand tint — still unmistakably not a photograph, no longer the loudest element |
| Category tiles were grey boxes with a word beneath | Tinted tiles that are designed objects in their own right, which a photograph later sits inside |
| Empty states were grey dashed boxes | Tinted with a brand edge; these appear often on a legitimately empty site |
| Footer faded into another off-white band | Deep blue, closing the page definitely |

**Two accessibility failures were introduced and caught by measurement, not by eye:**

- Body text on the brand band measured **3.43:1**. No lighter foreground could fix it, because white on the logo blue is itself only 4.33:1 — so the *surface* was darkened to `#1b73a6`, lifting white to 5.19:1. The logo blue is unchanged and still used for marks, rules and focus rings.
- The placeholder label measured **2.85:1** and failed outright. Now 6.37:1.

`tests/design-system.test.js` computes every brand pairing from the tokens on each run, so neither can silently return.

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
