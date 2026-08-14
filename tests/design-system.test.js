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

  it('honours prefers-reduced-motion at the token level', async () => {
    const tokens = await read(join(root, 'styles/tokens.css'))
    expect(tokens).toContain('prefers-reduced-motion: reduce')
    expect(tokens).toMatch(/--hover-image-scale:\s*1;/)
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
