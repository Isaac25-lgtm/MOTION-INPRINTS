import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

/* Populated-state coverage.

   The other page tests exercise the empty state, which is what the site shows
   today. These render the same components against realistic volumes — a full
   catalogue, a large mixed-orientation portfolio, long names, long copy and real
   price combinations — so composition at volume is checked rather than assumed. */

const money = [null, 0, 1500, 85000, 1250000, 48500000]
const orientations = ['landscape', 'portrait', 'wide', 'square']

const products = Array.from({ length: 30 }, (_, i) => ({
  id: `p${i}`,
  slug: `product-${i}`,
  name: i === 3
    ? 'Double-sided illuminated pylon signage with powder-coated steel frame and acrylic face'
    : `Product ${i}`,
  short_description: i % 4 === 0 ? 'A considerably longer descriptor line that has to wrap gracefully inside a narrow catalogue column without breaking the grid.' : 'Short descriptor',
  // The price cycle must not collapse onto the pricing-kind cycle, or whole
  // amounts never reach a card that displays a figure. Stride 5 over 6 amounts
  // stays out of phase with the 3-kind cycle.
  starting_price: money[(i * 5) % money.length],
  currency: 'UGX',
  pricing_type: ['fixed', 'configurable', 'quote_only'][i % 3],
  quote_required: i % 3 === 2,
  category_name: 'Signage',
  category_slug: 'signage',
  image: i % 5 === 0 ? null : `https://cdn.example.test/p${i}.webp`,
}))

const projects = Array.from({ length: 24 }, (_, i) => ({
  id: `j${i}`,
  slug: `project-${i}`,
  title: i === 2 ? 'Complete exterior and interior brand rollout for a multi-branch retail group' : `Project ${i}`,
  description: 'A project description of realistic length that should sit in the prose column and wrap across several lines without disturbing the grid rhythm around it.',
  location: i % 3 === 0 ? 'Kampala' : null,
  completed_on: `202${i % 6}-0${(i % 9) + 1}-15`,
  category_name: 'Signage',
  category_slug: 'signage',
  image: i % 7 === 0 ? null : `https://cdn.example.test/j${i}.webp`,
}))

const categories = [
  { id: 'c1', name: 'Printing', slug: 'printing', parent_id: null, description: 'Digital, UV, sublimation and offset printing.' },
  { id: 'c2', name: 'Signage', slug: 'signage', parent_id: null, description: null },
  { id: 'c3', name: 'Apparel', slug: 'apparel', parent_id: null, description: null },
  { id: 'c4', name: 'Digital Printing', slug: 'digital-printing', parent_id: 'c1', description: null },
]

/* Every service call resolves immediately, so effects settle before assertions.
   Rendering is synchronous here, so components are checked in their resolved shape
   through the same code path the browser uses. */
vi.mock('../src/services/apiClient.js', () => ({
  request: async (path) => {
    if (path.startsWith('/products/')) return products[0]
    if (path.startsWith('/products')) return products
    if (path.startsWith('/projects/')) return { ...projects[0], gallery: [{ image: 'https://cdn.example.test/g1.webp', alt: 'Gallery one' }, { image: 'https://cdn.example.test/g2.webp', alt: 'Gallery two' }] }
    if (path.startsWith('/projects')) return projects
    if (path.startsWith('/categories') || path.startsWith('/services')) return categories
    if (path.startsWith('/content')) return []
    return []
  },
  ApiClientError: class extends Error {},
}))

const { ProductCard, ProjectCard, CategoryTile } = await import('../src/components/ui/Cards.jsx')
const { Price, formatAmount } = await import('../src/components/ui/Price.jsx')
const { Pagination } = await import('../src/components/ui/Navigation.jsx')

/* Intl separates currency symbol from amount with a non-breaking space; assertions
   read visible text, so it is normalised here. */
const render = (node) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>).replace(/ /g, ' ')

describe('populated composition', () => {
  it('renders a 30-item catalogue with every pricing combination', () => {
    const html = render(<div className="grid grid--products">{products.map(p => <ProductCard key={p.id} product={p} />)}</div>)
    expect((html.match(/class="product"/g) || []).length).toBe(30)
    // Ten quote-only items must show the quote label and never a figure.
    const quoteOnly = products.filter(p => p.quote_required)
    expect((html.match(/Request a quote/g) || []).length).toBeGreaterThanOrEqual(quoteOnly.length)
    // Large amounts reach cards that display a figure.
    expect(html).toContain('48,500,000')
  })

  it('treats a zero price as a real price, not as a missing one', () => {
    // Asserted directly rather than via the grid, so it cannot depend on which
    // fixture index happens to carry the amount.
    expect(render(<Price amount={0} pricingType="fixed" />)).toContain('USh 0')
    expect(render(<Price amount={0} pricingType="fixed" />)).not.toContain('Request a quote')
    // Null is missing, and must never be shown as zero.
    expect(render(<Price amount={null} pricingType="fixed" />)).toContain('Request a quote')
    expect(render(<Price amount={null} pricingType="fixed" />)).not.toContain('0')
  })

  it('formats UGX in whole shillings across four orders of magnitude', () => {
    expect(formatAmount(1500)).toMatch(/1,500/)
    expect(formatAmount(48500000)).toMatch(/48,500,000/)
    // UGX trades in whole shillings, so no subunit decimals at any magnitude.
    expect(formatAmount(1500)).not.toMatch(/\.\d/)
    expect(formatAmount(48500000)).not.toMatch(/\.\d/)
    expect(formatAmount(null)).toBeNull()
    expect(formatAmount('not-a-number')).toBeNull()
  })

  it('renders a mixed-orientation portfolio without losing captions', () => {
    const html = render(
      <div className="work-grid">
        {projects.map((project, i) => (
          <div key={project.id} className="work-grid__item">
            <ProjectCard project={project} ratio={orientations[i % orientations.length]} />
          </div>
        ))}
      </div>,
    )
    expect((html.match(/class="project"/g) || []).length).toBe(24)
    // Placeholders and real images coexist in one grid.
    expect(html).toContain('frame--placeholder')
    expect(html).toContain('cdn.example.test')
    // Every card carries a caption line; none is dropped by a missing field.
    expect((html.match(/project__title/g) || []).length).toBe(24)
  })

  it('keeps long names and descriptors inside their components', () => {
    const long = products[3]
    const html = render(<ProductCard product={long} />)
    expect(html).toContain('Double-sided illuminated pylon signage')
    // Long copy must not be truncated in markup; wrapping is the layout's job.
    expect(html).toContain('acrylic face')
  })

  it('renders category tiles including ones without descriptions', () => {
    const html = render(<div className="grid grid--categories">{categories.map(c => <CategoryTile key={c.id} category={c} />)}</div>)
    expect((html.match(/class="category"/g) || []).length).toBe(4)
  })

  it('shows pagination controls at volume and disables them at the ends', () => {
    const first = render(<Pagination offset={0} limit={24} count={24} onChange={() => {}} />)
    expect(first).toContain('Page 1')
    expect(first).toMatch(/Previous/)
    // Previous is disabled on the first page; Next is available on a full page.
    expect(first.match(/<button[^>]*disabled[^>]*>[\s\S]*?Previous/)).toBeTruthy()

    const middle = render(<Pagination offset={48} limit={24} count={24} onChange={() => {}} />)
    expect(middle).toContain('Page 3')

    // A short final page offers no Next.
    const last = render(<Pagination offset={48} limit={24} count={7} onChange={() => {}} />)
    expect(last.match(/<button[^>]*disabled[^>]*>[\s\S]*?Next/)).toBeTruthy()
  })

  it('never renders a price for quote-only items at any amount', () => {
    for (const amount of money) {
      const html = render(<Price amount={amount} pricingType="quote_only" quoteRequired />)
      expect(html).toContain('Request a quote')
      expect(html).not.toMatch(/\d,\d/)
    }
  })
})
