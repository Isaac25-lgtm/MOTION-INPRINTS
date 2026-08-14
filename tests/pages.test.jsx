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
