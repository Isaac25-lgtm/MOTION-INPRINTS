# Category tile images

Drop images in **this folder** and they appear in **"Browse by what you need"** on the homepage and on the shop index. **No code change is needed** — the file is picked up by its name.

## Name the file after the section

The name must match the section's slug exactly, in lowercase.

| File to drop here | Section it fills |
| --- | --- |
| `printing.jpg` | Printing |
| `signage.jpg` | Signage |
| `promotional-display.jpg` | Promotional / Display |
| `apparel.jpg` | Apparel |
| `decor.jpg` | Décor |
| `design.jpg` | Design |
| `digital-solutions.jpg` | Digital Solutions |

Two easy mistakes:

- **`decor.jpg`, not `décor.jpg`.** No accent in the filename, even though the section displays as "Décor".
- **`promotional-display.jpg`** — one hyphen, no slash and no spaces, even though the section displays as "Promotional / Display".

`.jpg`, `.jpeg`, `.png`, `.webp` and `.avif` all work. Case in the name is ignored, so `Printing.JPG` is fine.

You do not have to supply all seven. Any section without a file here keeps what it shows today.

## What the tile does with the image

Tiles are **landscape** and the image is cropped to fill, centred. So:

- Keep the subject near the middle — the top and bottom get trimmed on wide screens.
- Around **1600px wide** is the sweet spot. Larger is wasted; much smaller looks soft on a retina screen.
- Aim for **under ~400 KB** each. Seven full-size camera files would make the homepage slow.

## Precedence

Highest wins:

1. A real image on the category record in the database (CMS or object storage)
2. **A file in this folder**
3. A licensed stock placeholder, where one has been verified — see `../photos/SOURCES.md`
4. A designed specimen

So these override the stock placeholders, and are themselves overridden the moment real images are loaded through the CMS. Nothing here needs deleting later.

## Two rules that still apply

**These tiles must not claim to be finished Motion work.** A tile links to a category of things Motion sells; it is not a portfolio entry. Photographs of actual completed jobs belong in `/work` and on project pages, loaded through the CMS where they can be captioned and credited properly.

**Use images you have the right to use** — Motion's own photographs, or something licensed for commercial use. Files in this folder are not covered by the stock manifest in `../photos/SOURCES.md`, which only records the temporary licensed placeholders. If you drop in a licensed stock image rather than Motion's own, record it there too so the licence stays traceable.
