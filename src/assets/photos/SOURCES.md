# Temporary image sources

Licensed placeholder photography, used until Motion supplies its own.

Every file below was verified on its **individual source page** at the time of download — not on a search-results page, which mixes free and paid tiers. Verification date: **14 August 2026**.

## In use

| File | Placement | Source page | Creator | Platform | Licence | Downloaded |
| --- | --- | --- | --- | --- | --- | --- |
| `category-printing.jpg` | "Printing" category tile | https://unsplash.com/photos/g9_KP2fvFII | Geri Sakti | Unsplash | Unsplash License (free, commercial use permitted, no attribution required) | 2026-08-14 |
| `category-promotional.jpg` | "Promotional & display" category tile | https://unsplash.com/photos/CYrYxz-uvE4 | Geri Sakti | Unsplash | Unsplash License (free, commercial use permitted, no attribution required) | 2026-08-14 |
| `category-apparel.jpg` | "Apparel" category tile | https://unsplash.com/photos/ZCTh4f4mv18 | emarts | Unsplash | Unsplash License (free, commercial use permitted, no attribution required) | 2026-08-14 |

**Unsplash License** (https://unsplash.com/license, verified 2026-08-14): free for commercial and non-commercial use, no permission or attribution required. Images may not be sold unmodified, and may not be compiled into a competing image service. Neither applies here.

### The homepage hero has no image, and no asset

Four heroes were tried and rejected after looking at each on screen:

1. **Type specimen** — well made, but read as a foundry sample rather than a print company.
2. **Wide-format banner printer** — authentic, but industrial rather than premium, hot pink and cyan fighting the palette, and a third party's printed job across the frame.
3. **Hand-pulled screen print** — warmer and genuinely premium, but one trade out of seven.
4. **Process-colour guide** (`hero-colour.jpg`, Pexels, Markus Spiske) — the best of the four and still wrong in place: it made the fold tall, opened the page with a large field of blue, and pushed category discovery below the first viewport.

Underneath all four was a structural problem: almost every stock workshop photograph is recognisably *somewhere else* — a Paris etching studio, a Vietnamese flag workshop, a European factory with a competitor's name on the wall. A visibly foreign hero undercuts a Kampala company.

**The hero is now text only.** `hero-colour.jpg` was deleted rather than parked, because a placeholder image with no approved placement is exactly the kind of asset that later drifts into a portfolio or product surface where it would assert work Motion did not do. It can be re-downloaded from the source URL above if the direction ever changes.

Do not add an image, specimen, mockup, gradient or abstract visual to that hero without an explicit decision from the owner. `tests/pages.test.jsx` fails if one appears.

### Category tiles

The screen-printing frame sits on **Apparel**, where it started. The banner printer sits on **Promotional & Display**, where a large printed banner is exactly the subject and strong colour is an asset at tile size. The two Geri Sakti images share a shoot, keeping the Printing and Promotional tiles consistent in lighting and contrast.

These three are fallbacks only. Owner-supplied files in `../categories/` take precedence over them, and a real CMS image takes precedence over both.

## Rejected, and why

| Candidate | Reason |
| --- | --- |
| unsplash.com/photos/HtfLrzej4TY | **Unsplash+ (paid, Getty Images)** — not free for commercial use |
| unsplash.com/photos/VwZooA-jsDw | **Unsplash+ (paid, Getty Images)** |
| unsplash.com/photos/xuL2GmOYZrU | **Unsplash+ (paid)** |
| unsplash.com/photos/QGV4bDr8Ymw | Free licence, but shows a **third-party brand's advertisement**. On a Motion category tile that implies Motion printed that campaign. |
| unsplash.com/photos/9dXGUQbtGoM | Free licence, but rejected on **quality**: cluttered workshop, poor lighting, iridescent sheet clashing with the palette. Downloaded, inspected, deleted. |
| pexels.com/photo/31788399 | Free licence, but a **competitor print shop's name and logo** appear on the wall and on a worker's shirt. |
| pexels.com/photo/3872397 | Free licence, excellent light, but the subject **looks directly at the lens**. An identifiable face on a company hero risks implying endorsement, which the Pexels License forbids. Also an art etching press, not commercial print. |
| pexels.com/photo/3966277 | Free licence, but a European stock model in an Italian studio — the "foreign studio" problem the hero is meant to avoid. |
| pexels.com/photo/27893029 | Free licence, but cluttered, fluorescent-lit, an identifiable face, and a logo on the subject's shirt. |
| pexels.com/photo/38487458 | Free licence and genuinely local in feel, but a market stall of manufactured wax fabric — wrong trade, and far too busy to sit behind hero type. |
| pexels.com/photo/20042067 | Free licence and premium looking, but the machine manufacturer's mark is legible in two places. |

Search-results pages list free and paid tiers together with no visible distinction, so **four of nine Unsplash candidates failed verification**. Never trust a search page — open the asset's own page. Every candidate above was also downloaded and *looked at*: descriptions did not surface the competitor logo, the direct-to-camera gaze or the clutter.

## Rules for anything added here

- Verify the licence on the asset's own page, at download time.
- Download into the repository. Never hotlink.
- **Never** place temporary imagery in `/work`, project pages, product detail or product catalogue cards — those assert that Motion completed the work or sells that exact item. Hero, About and high-level category tiles only.
- Alt text stays factual and illustrative: "Illustrative commercial printing equipment", never "Motion project".
- No Google Images, Pinterest, X, Instagram, Facebook, competitor sites, watermarked files, or anything whose origin cannot be traced. Pinterest may be used to decide *what to shoot*, never as a file source.
- No AI-generated imagery.
- Motion's own social assets are not to be scraped; they may be used later only after the owner selects them.

## Replacement

Each of these is overridden the moment real content exists — a CMS `hero` image, or a `category.image` from object storage — without any code change. They are a floor, not a design goal.
