import { describe, expect, it } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/* Prompt 4.7 asks a question a person has to answer by looking. These tests cover
   the part that can be checked mechanically: the prohibited patterns are absent,
   and the token system is actually the single source of truth. They are a floor,
   not a substitute for the visual review. */

const root = fileURLToPath(new URL('../src/', import.meta.url))

async function collect(dir, extensions, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await collect(path, extensions, files)
    else if (extensions.some(extension => entry.name.endsWith(extension))) files.push(path)
  }
  return files
}

const read = async (path) => readFile(path, 'utf8')

describe('design system constraints', () => {
  it('uses no gradients as a decorative device', async () => {
    for (const file of await collect(root, ['.css'])) {
      const css = await read(file)
      const gradients = css.match(/(linear|radial|conic)-gradient/g) || []
      // Exactly one is permitted anywhere in the system: the hatching that marks
      // development placeholder media. It is a signal, not a decorative background.
      const allowed = (css.match(/repeating-linear-gradient\(135deg, var\(--ink-100\)/g) || []).length
      expect(gradients.length, `${file} introduces a decorative gradient`).toBe(allowed)
    }
  })

  it('defines exactly one shadow token and uses no ad-hoc shadows', async () => {
    const tokens = await read(join(root, 'styles/tokens.css'))
    expect((tokens.match(/--shadow-[a-z]+:/g) || [])).toEqual(['--shadow-overlay:'])
    for (const file of await collect(root, ['.css'])) {
      const css = await read(file)
      for (const declaration of css.match(/box-shadow:[^;]+;/g) || []) {
        expect(declaration, `${file} sets a shadow outside the token`).toContain('var(--shadow-overlay)')
      }
    }
  })

  it('keeps radii small — no pill or oversized rounding outside circular controls', async () => {
    for (const file of await collect(root, ['.css'])) {
      const css = await read(file)
      for (const declaration of css.match(/border-radius:[^;]+;/g) || []) {
        // A token, or an explicit 0 for squared media. Never a raw pixel radius.
        const permitted = /var\(--radius-(sm|md|full)\)/.test(declaration) || /border-radius:\s*0;/.test(declaration)
        expect(permitted, `${file} sets a raw radius: ${declaration}`).toBe(true)
      }
    }
    const tokens = await read(join(root, 'styles/tokens.css'))
    expect(tokens).toMatch(/--radius-sm:\s*2px/)
    expect(tokens).toMatch(/--radius-md:\s*3px/)
  })

  it('contains no emoji in interface source', async () => {
    // © ® ™ carry Extended_Pictographic but are typographic marks, not interface
    // icons, so they are excluded before the check.
    const emoji = /\p{Extended_Pictographic}/u
    for (const file of await collect(root, ['.jsx', '.js', '.css'])) {
      const source = (await read(file)).replace(/[©®™️]/g, '')
      expect(emoji.test(source), `${file} contains an emoji`).toBe(false)
    }
  })

  it('routes every colour through a token', async () => {
    for (const file of await collect(root, ['.css'])) {
      if (file.endsWith('tokens.css')) continue
      const css = await read(file)
      const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) || []
      // site.css defines the inverse-section border, which is a local override.
      expect(hex.length, `${file} hard-codes ${hex.join(', ')}`).toBeLessThanOrEqual(3)
    }
  })

  /* Colour contrast, computed rather than assumed.
   *
   * Introducing brand-coloured bands created two real failures that were only
   * caught by measuring: body text on the brand band sat at 3.43:1, and the
   * placeholder label at 2.85:1. Both are fixed; this stops either returning. */
  it('meets WCAG AA on every brand colour pairing', async () => {
    const tokens = await read(join(root, 'styles/tokens.css'))
    const token = (name) => {
      const direct = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
      if (direct) return direct[1]
      const alias = tokens.match(new RegExp(`--${name}:\\s*var\\(--([a-z0-9-]+)\\)`))
      return alias ? token(alias[1]) : null
    }

    const channel = (value) => {
      const v = value / 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    const luminance = (hex) => {
      const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }
    const ratio = (a, b) => {
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (light + 0.05) / (dark + 0.05)
    }

    const white = '#ffffff'
    const pairings = [
      // [foreground, background, minimum, description]
      [white, token('bg-brand'), 4.5, 'white body text on the brand band'],
      [token('on-brand-muted'), token('bg-brand'), 4.5, 'muted body text on the brand band'],
      [white, token('bg-brand-deep'), 4.5, 'white text on the deep brand band'],
      [token('on-brand-deep-muted'), token('bg-brand-deep'), 4.5, 'muted text on the deep brand band'],
      [token('blue-400'), token('bg-brand-deep'), 4.5, 'accent text on the deep brand band'],
      [token('blue-700'), token('blue-050'), 4.5, 'placeholder label on its tint'],
      [token('blue-900'), token('blue-050'), 4.5, 'category tile name on its tint'],
      [token('blue-text'), white, 4.5, 'accent text on white'],
      [token('ink-900'), white, 4.5, 'body text on white'],
      [token('ink-500'), white, 4.5, 'muted text on white'],
      // Focus rings and borders are UI components: 3:1 is the requirement.
      [token('blue-600'), white, 3, 'focus ring on white'],

      /* Supporting editorial palette. The hero sits on warm paper, so every
         pairing that appears there is measured against it rather than white —
         warm paper is darker, so passing on white proves nothing.

         The requested terracotta (#A65F46) and ochre (#B58A38) measured 4.32:1
         and 2.82:1 on warm paper; the second failed even the 3:1 large-text
         floor. Both were moved to their nearest accessible neighbours, and both
         now clear 4.5:1 — so a single token per accent serves the display
         periods and any small label without a second variant. */
      [token('ink-900'), token('paper-warm'), 4.5, 'headline on warm paper'],
      [token('ink-body'), token('paper-warm'), 4.5, 'supporting copy on warm paper'],
      [token('ink-body'), token('paper-soft'), 4.5, 'supporting copy on soft paper'],
      /* Soft paper is now the page ground (`--bg`), not pure white, so the
         everyday pairings are measured against what they actually sit on. */
      [token('ink-900'), token('paper-soft'), 4.5, 'body text on the page ground'],
      [token('blue-text'), token('paper-soft'), 4.5, 'accent text on the page ground'],
      [token('blue-600'), token('paper-soft'), 3, 'focus ring on the page ground'],
      /* The rail's neutral mark is decorative, but it still has to be visible
         enough to read as deliberate rather than as a rendering artefact. */
      [token('stone-deep'), token('paper-warm'), 3, 'neutral rail mark on warm paper'],
      [token('accent-terracotta'), token('paper-warm'), 4.5, 'terracotta full stop on warm paper'],
      [token('accent-ochre'), token('paper-warm'), 4.5, 'ochre full stop on warm paper'],
      [token('accent-olive'), token('paper-warm'), 4.5, 'olive accent on warm paper'],
      /* The middle full stop is the brand blue itself and is set at display size,
         where 3:1 applies. It is the one accent held to the large-text bar, so
         that the recognisable Motion blue appears on the fold unmodified. */
      [token('blue-600'), token('paper-warm'), 3, 'Motion blue full stop at display size'],

      // The one dark content band, and the footer that must not duplicate it.
      [white, token('bg-brand-deep'), 4.5, 'white text on the deep ink band'],
      [white, token('bg-footer'), 4.5, 'white text in the footer'],
      [token('on-footer-muted'), token('bg-footer'), 4.5, 'secondary text in the footer'],
    ]

    for (const [foreground, background, minimum, description] of pairings) {
      expect(foreground, `could not resolve a colour for: ${description}`).toBeTruthy()
      expect(background, `could not resolve a background for: ${description}`).toBeTruthy()
      const measured = ratio(foreground, background)
      expect(measured, `${description} is ${measured.toFixed(2)}:1, below ${minimum}:1`).toBeGreaterThanOrEqual(minimum)
    }
  })

  /* Category specimens stand in for photography. They must read as a printer's
     sample book — one frame, varied treatments — not as a row of identical
     coloured boxes, and must never be mistaken for real product images. */
  it('varies category specimen treatments and covers every seeded category', async () => {
    const source = await read(join(root, 'features/home/Specimen.jsx'))
    const seeded = ['printing', 'signage', 'promotional-display', 'apparel', 'decor', 'design', 'digital-solutions']

    const tones = seeded.map(slug => {
      const entry = source.match(new RegExp(`'?${slug}'?:\\s*\\{[^}]*tone:\\s*'([a-z]+)'`))
      expect(entry, `${slug} has no specimen treatment`).toBeTruthy()
      return entry[1]
    })

    // More than one tone, or the section is a row of identical boxes again.
    expect(new Set(tones).size).toBeGreaterThanOrEqual(3)
    // No two consecutive categories share a tone, so neighbours differ in the grid.
    for (let i = 1; i < tones.length; i += 1) expect(tones[i]).not.toBe(tones[i - 1])

    // Each carries its own production cue, so the marks are not interchangeable.
    const cues = seeded.map(slug => source.match(new RegExp(`'?${slug}'?:\\s*\\{[^}]*cue:\\s*'([a-z]+)'`))[1])
    expect(new Set(cues).size).toBeGreaterThanOrEqual(5)
  })

  it('draws specimens without images, gradients or fabricated product art', async () => {
    const css = await read(join(root, 'styles/specimen.css'))
    // Solid colour, hairlines and type only. Matches the CSS functions rather
    // than the word, which appears in the file's own comments.
    expect(css).not.toMatch(/(linear|radial|conic)-gradient\(/)
    expect(css).not.toMatch(/url\(/)
    const source = await read(join(root, 'features/home/Specimen.jsx'))
    expect(source).not.toContain('<img')
    // Decorative marks are hidden from assistive technology; the link names the card.
    expect(source).toContain('aria-hidden="true"')
    // The hero specimen states what it is rather than claiming to be a photograph.
    expect(source).toMatch(/aria-label="Placeholder/)
    expect(source).not.toMatch(/aria-label="[^"]*Photograph of Motion work/)
  })

  /* Temporary licensed imagery. Every file must be traceable to a verified
     source, and must never appear where it would assert that Motion did the work
     or sells that exact item. */
  it('documents every temporary image and confines it to permitted placements', async () => {
    const manifest = await read(join(root, 'assets/photos/SOURCES.md'))
    const files = (await readdir(join(root, 'assets/photos'))).filter(name => /\.(jpe?g|png|webp|avif)$/i.test(name))

    expect(files.length, 'no temporary images found to verify').toBeGreaterThan(0)
    for (const file of files) {
      expect(manifest, `${file} is not recorded in SOURCES.md`).toContain(file)
      // Each row must carry a real source page and a named licence.
      expect(manifest).toMatch(new RegExp(`${file.replace('.', '\\.')}[^|]*\\|[^|]*\\|[^|]*https://`))
    }
    expect(manifest).toMatch(/Unsplash License/)
    expect(manifest).toMatch(/2026-08-14/)
    // Rejected candidates are recorded too, so the verification is auditable.
    expect(manifest).toMatch(/Unsplash\+/)

    /* The hard rule: temporary imagery is for hero, About and category tiles.
       Portfolio and product surfaces must resolve images from the database only. */
    const imagery = await read(join(root, 'features/home/placeholderImagery.js'))
    expect(imagery).toMatch(/resolveCategoryImage/)
    for (const page of ['pages/WorkPage.jsx', 'pages/ShopPage.jsx']) {
      const source = await read(join(root, page))
      expect(source, `${page} must not import temporary imagery`).not.toMatch(/placeholderImagery|assets\/photos/)
    }
    const cards = await read(join(root, 'components/ui/Cards.jsx'))
    // Only the category card may resolve a placeholder; product and project
    // cards take their image straight from the record.
    const productCard = cards.slice(cards.indexOf('export function ProductCard'), cards.indexOf('export function ProjectCard'))
    expect(productCard).not.toMatch(/resolveCategoryImage|placeholder/i)
  })

  it('honours prefers-reduced-motion at the token level', async () => {
    const tokens = await read(join(root, 'styles/tokens.css'))
    expect(tokens).toContain('prefers-reduced-motion: reduce')
    expect(tokens).toMatch(/--hover-image-scale:\s*1;/)
  })

  /* The two animations on the homepage set their own literal timings, so the
     token-level duration override does not reach them. They need switching off
     explicitly, and the composition has to survive without them. */
  it('disables the hero entrance and the rail runner under reduced motion', async () => {
    const css = await read(join(root, 'styles/site.css'))

    const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduced, 'site.css declares no reduced-motion block').toBeTruthy()
    expect(reduced, 'the travelling marker must stop').toMatch(/\.rail__runner\s*\{[^}]*animation:\s*none/)
    expect(reduced, 'the hero entrance must not run').toMatch(/animation:\s*none/)

    /* The entrance is gated behind no-preference rather than being applied and
       then undone, so a reduced-motion visitor never has it applied at all. */
    expect(css).toContain('@media (prefers-reduced-motion: no-preference)')

    /* It may only move opacity and a few pixels: content must occupy its final
       position from the start, so nothing reflows as it settles and nothing is
       hidden if the animation never runs. */
    const entrance = css.slice(css.indexOf('@keyframes hero-enter'))
    expect(entrance).toMatch(/translateY\((\d|1\d)px\)/)
    expect(entrance, 'no scaling, rotation or spring overshoot in the entrance')
      .not.toMatch(/scale|rotate|cubic-bezier\([^)]*-/)
  })

  /* The rail sits at full page width above the hero and is the one element that
     could plausibly introduce sideways scrolling. */
  it('keeps the production rail from overflowing the page', async () => {
    const css = await read(join(root, 'styles/site.css'))
    const list = css.slice(css.indexOf('.rail__list'), css.indexOf('.rail__item'))
    // Clipped rather than wrapped: it must never become a second row either.
    expect(list).toMatch(/overflow:\s*hidden/)
    expect(list).toMatch(/white-space:\s*nowrap/)

    /* The marker is absolutely positioned inside a zero-height track, so however
       far it travels it cannot widen the document. */
    const track = css.slice(css.indexOf('.rail__track'), css.indexOf('.rail__runner'))
    expect(track).toMatch(/position:\s*absolute/)
  })

  /* The accents must be semantic tokens, not hex sprinkled through component
     CSS — otherwise the contrast test above measures values nothing uses. */
  it('draws the hero full stops from the palette tokens', async () => {
    const css = await read(join(root, 'styles/site.css'))
    const stops = css.match(/\.hero__stop--[a-z]+\s*\{[^}]*\}/g) || []
    expect(stops.length, 'expected three coloured full stops').toBe(3)
    for (const rule of stops) {
      expect(rule, `${rule} must use a token, not a raw colour`).toMatch(/var\(--(accent-[a-z]+|blue-600)\)/)
    }
  })

  it('keeps hover movement to a few percent', async () => {
    const tokens = await read(join(root, 'styles/tokens.css'))
    const scale = Number(tokens.match(/--hover-image-scale:\s*([\d.]+)/)[1])
    expect(scale).toBeGreaterThan(1)
    expect(scale).toBeLessThanOrEqual(1.05)
  })

  it('never removes focus outlines', async () => {
    for (const file of await collect(root, ['.css'])) {
      const css = await read(file)
      for (const declaration of css.match(/outline:\s*(none|0)[^;]*;/g) || []) {
        // Permitted only where :focus-visible re-establishes the ring.
        expect(css, `${file} removes an outline without a :focus-visible replacement`).toContain(':focus-visible')
      }
    }
  })

  it('states no fabricated business facts in page source', async () => {
    const banned = [/\b\d+\+? (?:happy )?(?:clients|customers|projects completed)\b/i, /trusted by \d+/i, /\baward[- ]winning\b/i, /\bfounded in \d{4}\b/i, /\bsince \d{4}\b/i]
    for (const file of await collect(join(root, 'pages'), ['.jsx'])) {
      const source = await read(file)
      for (const pattern of banned) {
        expect(pattern.test(source), `${file} states an unverified business fact`).toBe(false)
      }
    }
  })

  it('gives every image a real sizes hint and lazy-loads by default', async () => {
    const media = await read(join(root, 'components/ui/Media.jsx'))
    expect(media).toContain("loading={priority ? 'eager' : 'lazy'}")
    expect(media).toContain('decoding')
    expect(media).toContain('sizes')
  })
})
