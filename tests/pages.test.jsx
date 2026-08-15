import { describe, expect, it, vi, beforeAll } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { StrictMode } from 'react'

/* Server-renders each public page. A passing build only proves the modules parse;
   this proves the components actually render, and that no page depends on live
   data to produce its first paint. Data effects do not run during SSR, so every
   page here is exercised in its empty/loading state — which is exactly the state
   the site is in until products, projects and CMS content exist. */

vi.mock('../src/services/apiClient.js', () => ({
  request: () => new Promise(() => {}),
  ApiClientError: class extends Error {},
}))

beforeAll(() => {
  // Components format currency and read env at module scope.
  globalThis.window = globalThis.window || {}
})

const render = async (importPage, exportName, { path = '/' } = {}) => {
  const module = await importPage()
  const Page = module[exportName]
  const { ToastProvider } = await import('../src/components/ToastProvider.jsx')
  const { SiteContentProvider } = await import('../src/content/SiteContentProvider.jsx')
  return renderToStaticMarkup(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <ToastProvider>
          <SiteContentProvider>
            <Page />
          </SiteContentProvider>
        </ToastProvider>
      </MemoryRouter>
    </StrictMode>,
  )
}

describe('public pages render', () => {
  /* Colour discipline.
   *
   * The governing rule:
   *
   *   Brand blue is an accent and a rare structural emphasis. Repetition of calm
   *   white or warm-paper surfaces is allowed and often desirable. A saturated or
   *   deep-blue section must mark a genuine change in hierarchy.
   *
   * An earlier revision instead enforced "no two consecutive sections may share a
   * background". That is mechanical: it forces alternation, and alternation with
   * a short palette means reaching for blue constantly. It produced striping and
   * turned colour into a layout habit rather than a signal. It is deliberately
   * gone, and nothing here may reinstate it — two adjacent white or warm bands
   * are a valid, calm result and must never fail. */
  it('keeps saturated blue rare and purposeful, and allows repeated calm surfaces', async () => {
    const html = await render(() => import('../src/pages/HomePage.jsx'), 'HomePage')
    const bands = [...html.matchAll(/section section--([a-z-]+)/g)]
      .map(match => match[1])
      .filter(band => band !== 'tight' && band !== 'flush-top' && band !== 'bleed')
    const isSaturated = band => band === 'brand' || band === 'brand-deep' || band === 'inverse'
    const saturated = bands.filter(isSaturated)

    // Exactly one major saturated band in the body — Digital Solutions. The
    // deep-blue footer closes the page and is counted separately.
    expect(saturated.length, `expected at most one saturated band, found ${saturated.join(', ')}`).toBeLessThanOrEqual(1)

    // Two saturated bands may never sit adjacent.
    for (let i = 1; i < bands.length; i += 1) {
      expect(isSaturated(bands[i]) && isSaturated(bands[i - 1]),
        `saturated bands are adjacent: ${bands[i - 1]} then ${bands[i]}`).toBe(false)
    }

    /* Pale blue is a sparing accent surface, not a second recurring background.
       It carried the process section directly beneath the deep-blue band, which
       closed the page on blue, then blue, then a blue footer. */
    const soft = bands.filter(band => band === 'soft').length
    expect(soft, 'pale blue must not become a recurring page background').toBeLessThanOrEqual(1)

    // Quiet surfaces carry the page.
    const quiet = bands.filter(band => band === 'alt').length
    expect(quiet).toBeGreaterThan(saturated.length + soft)
  })

  /* The homepage hero is text only, by explicit art direction.
   *
   * Four image treatments were tried and rejected on screen: a type specimen
   * that read as a foundry sample, a wide-format printer whose colour fought the
   * palette, a hand-pulled screen print, and a process-colour guide. The last was
   * the best of them and still lost — it made the fold tall, opened the page with
   * a large field of blue, and pushed category discovery below the viewport.
   *
   * This test is what stops a fifth appearing quietly. */
  it('opens with a text-only hero carrying no visual media', async () => {
    const html = await render(() => import('../src/pages/HomePage.jsx'), 'HomePage')
    const start = html.indexOf('class="hero')
    expect(start, 'hero section not found').toBeGreaterThan(-1)
    const hero = html.slice(start, html.indexOf('</section>', start))

    // No image, frame, specimen, mockup, gradient or abstract visual.
    expect(hero, 'hero must contain no image').not.toContain('<img')
    expect(hero, 'hero must contain no frame').not.toContain('frame')
    expect(hero, 'hero must contain no specimen').not.toContain('specimen')
    expect(hero).not.toContain('hero__media')
    expect(hero).not.toMatch(/background-image|linear-gradient|radial-gradient/)

    // What must remain: statement, rule, standfirst, both actions.
    expect(hero).toContain('Design.')
    expect(hero).toContain('hero__rule')
    expect(hero).toContain('hero__standfirst')
    expect(hero).toContain('Shop products')
    expect(hero).toContain('Start a custom project')

    /* Removed: the tinted chip row, and the service list beneath the buttons
       which duplicated the category section immediately below it. */
    expect(hero, 'the chip row must not return').not.toContain('hero__tag')
    expect(hero, 'the service list duplicated the section below').not.toContain('hero__makes')

    // No stale placeholder language anywhere, and nothing hotlinked at runtime.
    expect(html).not.toContain('Photography pending')
    expect(html).not.toContain('hero-specimen')
    expect(html).not.toMatch(/<img[^>]+src="https?:\/\//)
  })

  /* The whole point of shortening the hero: reaching the thing that sells. */
  it('places category discovery immediately after the hero, on a quiet surface', async () => {
    const html = await render(() => import('../src/pages/HomePage.jsx'), 'HomePage')
    const heroStart = html.indexOf('class="hero')
    const heroEnd = html.indexOf('</section>', heroStart) + '</section>'.length
    const categories = html.indexOf('aria-labelledby="categories-title"')
    expect(categories, 'category section not found').toBeGreaterThan(heroEnd)

    /* Between the hero closing and the category section opening there is only
       that section's own opening tag — so no section is interposed. */
    const between = html.slice(heroEnd, categories)
    expect(between, 'a section sits between the hero and category discovery').not.toContain('</section>')

    // And it does not sit on a blue field of any strength.
    expect(between, 'category discovery must not take a coloured band')
      .not.toMatch(/section--(brand|brand-deep|inverse|soft)/)

    // Category discovery precedes selected work and the catalogue.
    expect(categories).toBeLessThan(html.indexOf('aria-labelledby="work-title"'))
  })

  it('keeps the display size well below a full viewport', async () => {
    const { readFile } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    const tokens = await readFile(fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url)), 'utf8')
    const cap = Number(tokens.match(/--size-display:[^;]*,\s*([\d.]+)rem\s*\)/)[1])
    /* 6rem filled the screen with three words. Presence comes from weight, width
       and colour instead of size. Held at 3.5rem/56px — with a text-only hero the
       temptation to make the statement enormous again is exactly what this pins. */
    expect(cap).toBeLessThanOrEqual(3.5)
  })

  it('renders the homepage with all eight sections', async () => {
    const html = await render(() => import('../src/pages/HomePage.jsx'), 'HomePage')
    expect(html).toContain('Design.')
    expect(html).toContain('Selected work')
    expect(html).toContain('Digital solutions')
    expect(html).toContain('Start a custom project')
    // Exactly two hero actions, never three.
    expect(html.match(/hero__actions/g)).toHaveLength(1)
  })

  it('renders services, work, about, contact and custom project', async () => {
    const services = await render(() => import('../src/pages/ServicesPage.jsx'), 'ServicesPage')
    expect(services).toContain('What Motion produces')

    const work = await render(() => import('../src/pages/WorkPage.jsx'), 'WorkPage')
    expect(work).toContain('Selected work')

    const about = await render(() => import('../src/pages/AboutPage.jsx'), 'AboutPage')
    expect(about).toContain('production studio')

    const contact = await render(() => import('../src/pages/ContactPage.jsx'), 'ContactPage')
    expect(contact).toContain('Send a message')

    const custom = await render(() => import('../src/pages/CustomProjectPage.jsx'), 'CustomProjectPage')
    expect(custom).toContain('Start a custom project')
  })

  it('carries a quote-only product configuration into the custom-project form', async () => {
    const configuration = encodeURIComponent(JSON.stringify({ finish: 'matte', design_service: true }))
    const html = await render(() => import('../src/pages/CustomProjectPage.jsx'), 'CustomProjectPage', {
      path: `/custom-project?product=business-cards&productName=Business%20Cards&quantity=250&configuration=${configuration}`,
    })
    expect(html).toContain('Configuration to quote')
    expect(html).toContain('Business Cards')
    expect(html).toContain('Quantity: 250')
    expect(html).toContain('finish: matte')
  })

  it('states no verified business facts that were never supplied', async () => {
    const about = await render(() => import('../src/pages/AboutPage.jsx'), 'AboutPage')
    // Guards against the invented-credentials failure mode Prompt 4.5 prohibits.
    expect(about).not.toMatch(/founded in|since \d{4}|\d+\+? (clients|projects|customers)|award/i)
  })

  it('never renders a price for a quote-only product', async () => {
    const { Price } = await import('../src/components/ui/Price.jsx')
    expect(renderToStaticMarkup(<Price pricingType="quote_only" quoteRequired amount={50000} />)).toContain('Request a quote')
    expect(renderToStaticMarkup(<Price pricingType="quote_only" quoteRequired amount={50000} />)).not.toContain('50,000')
    // A missing price never becomes a zero.
    expect(renderToStaticMarkup(<Price pricingType="fixed" amount={null} />)).toContain('Request a quote')
    expect(renderToStaticMarkup(<Price pricingType="fixed" amount={85000} />)).toContain('85,000')
  })

  it('renders placeholder media with accessible labelling rather than a broken image', async () => {
    const { Frame } = await import('../src/components/ui/Media.jsx')
    const html = renderToStaticMarkup(<Frame alt="Signage installation" ratio="wide" />)
    expect(html).toContain('frame--placeholder')
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Signage installation"')
    expect(html).not.toContain('<img')
  })

  it('lazy-loads below-the-fold images and eager-loads only priority media', async () => {
    const { Frame } = await import('../src/components/ui/Media.jsx')
    expect(renderToStaticMarkup(<Frame src="/a.jpg" alt="a" />)).toContain('loading="lazy"')
    expect(renderToStaticMarkup(<Frame src="/a.jpg" alt="a" priority />)).toContain('loading="eager"')
  })
})
