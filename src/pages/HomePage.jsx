import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { ProductCard, ProjectCard, CategoryTile } from '../components/ui/Cards'
import { Async, EmptyState, SkeletonGrid } from '../components/ui/States'
import { Icon } from '../components/ui/Icon'
import { useResource } from '../hooks/useResource'
import { productService } from '../services/productService'
import { projectService } from '../services/projectService'
import { categoryService } from '../services/categoryService'
import { useSiteContent, useContactDetails } from '../content/SiteContentProvider'

/* Section header: eyebrow, heading, and an optional link pushed to the right.
   Left-aligned by default — consecutive centred headings are the template tell. */
function SectionHead({ eyebrow, title, intro, action }) {
  return (
    <div className="section-head">
      <div className="section-head__text">
        {eyebrow && <p className="t-eyebrow">{eyebrow}</p>}
        <h2 className="t-h2">{title}</h2>
        {intro && <p className="t-body t-muted t-measure">{intro}</p>}
      </div>
      {action}
    </div>
  )
}

/* 1. Hero — a compact, centred, text-only masthead.
 *
 * Deliberately carries no image, specimen, mockup or gradient. Three previous
 * versions put visual media here and each one cost more than it returned: a
 * type specimen read as a foundry sample, a wide-format printer clashed with
 * the palette, and a colour-swatch photograph made the fold tall, front-loaded
 * the page with blue, and pushed category discovery below the viewport.
 *
 * A print company's masthead can simply be well-set type. Restraint here is
 * cheaper and more confident than any stock image, and it gets the reader to
 * "What we make" — the section that actually sells — in the first screen.
 *
 * Blue is limited to small marks: the eyebrow, the short rule, the primary
 * action and the focus ring. No coloured field, no chip row, and no service
 * list beneath the buttons — that list duplicated the section directly below.
 *
 * Copy is CMS-overridable. The fallback statement is Motion's own trading name,
 * not invented marketing language. The CMS hero image field is intentionally
 * left unrendered rather than deleted: the schema stays available for a future
 * direction, but nothing draws an image here until that is an explicit
 * decision. */
function Hero() {
  const { field } = useSiteContent()
  const headline = field('hero', 'default', 'headline')
  const standfirst = field('hero', 'default', 'standfirst')

  return (
    <section className="hero container" aria-labelledby="hero-title">
      <p className="t-eyebrow t-eyebrow--accent">Kampala · Design, print &amp; brand</p>
      <h1 className="t-display hero__lines" id="hero-title">
        {headline || <><span>Design.</span><span>Print.</span><span>Brand.</span></>}
      </h1>
      <div className="hero__rule" aria-hidden="true" />
      <p className="t-body-lg t-muted hero__standfirst">
        {/* Fallback lists what Motion offers. It makes no claim about how the work
            is produced — that is for the owner to state through the CMS. */}
        {standfirst || 'Signage, commercial printing, promotional materials and branded apparel — plus the websites, online stores and point-of-sale systems that run alongside them.'}
      </p>
      <div className="hero__actions">
        <Button to="/shop" variant="accent">Shop products</Button>
        <Button to="/custom-project" variant="secondary">Start a custom project</Button>
      </div>
    </section>
  )
}

/* 2. Category discovery — real photography with names set beneath, not icon cards.
 *
 * Sits directly after the hero on a white surface. It previously ran on a pale
 * blue band, which made the top of the page read as two coloured panels before
 * any actual work appeared. The tiles carry their own variation, so they do not
 * need a coloured field behind them to look composed.
 *
 * `--tight` on the top padding is deliberate: with a text-only hero this is what
 * brings the section head inside the first desktop viewport instead of leaving a
 * band of empty white above it. */
function Categories() {
  const state = useResource(({ signal }) => categoryService.list({ signal }), [])
  return (
    <section className="section section--tight" aria-labelledby="categories-title"><div className="container">
      <SectionHead
        eyebrow="What we make"
        title={<span id="categories-title">Browse by what you need</span>}
        action={<Button to="/shop" variant="text" arrow>All products</Button>}
      />
      <Async
        state={state}
        skeleton={<SkeletonGrid count={6} className="grid grid--categories" ratio="4 / 3" />}
        empty={<EmptyState title="Categories are not published yet" description="Publish categories from the admin area and they will appear here." />}
      >
        {(categories) => {
          const parents = categories.filter(category => !category.parent_id)
          return (
            <div className="grid grid--categories">
              {parents.map(category => (
                <CategoryTile
                  key={category.id}
                  category={category}
                  /* The descriptor is this category's real child services, so the
                     card says something specific without any invented copy. */
                  services={categories.filter(child => child.parent_id === category.id)}
                />
              ))}
            </div>
          )
        }}
      </Async>
      </div>
    </section>
  )
}

/* 3. Selected work — the defining section. One large project beside a stack of
   smaller ones, captions beneath the images rather than typeset across them. */
function SelectedWork() {
  const state = useResource(({ signal }) => projectService.list({ limit: 5 }, { signal }), [])
  return (
    <section className="section section--alt" aria-labelledby="work-title">
      <div className="container">
        <SectionHead
          eyebrow="Selected work"
          title={<span id="work-title">Recent projects</span>}
          action={<Button to="/work" variant="text" arrow>All work</Button>}
        />
        <Async
          state={state}
          skeleton={<SkeletonGrid count={3} className="grid grid--trio" ratio="4 / 3" />}
          empty={(
            <EmptyState
              title="No published projects yet"
              description="Motion's completed work will appear here once projects are added and published in the admin area. Nothing is shown until then — this space is reserved for real photography."
            />
          )}
        >
          {(projects) => {
            const [lead, ...rest] = projects
            return (
              <div className="feature-row">
                <ProjectCard project={lead} ratio="landscape" sizes="(min-width: 62rem) 55vw, 92vw" />
                <div className="feature-row__aside">
                  {rest.slice(0, 2).map(project => (
                    <ProjectCard key={project.id} project={project} ratio="landscape" sizes="(min-width: 62rem) 32vw, 92vw" />
                  ))}
                </div>
              </div>
            )
          }}
        </Async>
      </div>
    </section>
  )
}

/* 4. Featured products — owner-selected via the admin CMS. Price or quote status
   only; nothing is fabricated to make the grid look finished. */
function FeaturedProducts() {
  const state = useResource(({ signal }) => productService.list({ featured: 'true', limit: 8 }, { signal }), [])
  return (
    <section className="container section" aria-labelledby="products-title">
      <SectionHead
        eyebrow="From the catalogue"
        title={<span id="products-title">Popular products</span>}
        action={<Button to="/shop" variant="text" arrow>Shop all</Button>}
      />
      <Async
        state={state}
        skeleton={<SkeletonGrid count={4} />}
        empty={(
          <EmptyState
            title="No featured products yet"
            description="Mark products as featured in the admin area to show them here."
            action={<Button to="/quote" variant="secondary" size="sm">Request a quote instead</Button>}
          />
        )}
      >
        {(products) => (
          <div className="grid grid--products">
            {products.map(product => <ProductCard key={product.id} product={product} />)}
          </div>
        )}
      </Async>
    </section>
  )
}

/* 5. Custom projects — the work that does not fit a cart. */
function CustomProjects() {
  const examples = ['Custom signage', 'Office branding', 'Large installations', 'Event branding', 'Specialised production']
  /* Warm off-white, not a blue field. Custom work is the highest-value thing
     Motion does, so it needs emphasis — but emphasis here comes from a marked
     eyebrow, a blue rule, the accent button and the weight of the list beside
     it. A saturated band would make this the second of two blue sections in a
     row and turn colour into a layout habit rather than a signal. */
  return (
    <section className="section section--alt" aria-labelledby="custom-title">
      <div className="container">
        <div className="split">
          <div className="stack stack--lg">
            <div className="stack">
              <p className="t-eyebrow t-eyebrow--accent">Custom work</p>
              <h2 className="t-h2" id="custom-title">Not everything fits in a cart</h2>
              <div className="accent-rule" aria-hidden="true" />
              <p className="t-body-lg t-muted t-measure">
                Much of what Motion produces is measured, made and installed for one
                specific place. Tell us what you need and we will quote it properly.
              </p>
            </div>
            <Button to="/custom-project" variant="accent">Start a custom project</Button>
          </div>
          <ul className="detail-list">
            {examples.map(example => (
              <li className="detail-list__row" key={example} style={{ gridTemplateColumns: '1fr auto' }}>
                <span className="t-h4">{example}</span>
                <Icon name="arrowUpRight" size={18} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* 6. Digital solutions — the second half of the business, on a dark band so it
   reads as part of Motion rather than a separate technology company. Deep brand
   blue rather than neutral black keeps the whole page on one palette. */
function DigitalSolutions() {
  const offerings = [
    { slug: 'website-design', name: 'Website design', note: 'Business and campaign sites, designed and built end to end.' },
    { slug: 'ecommerce-website-development', name: 'E-commerce development', note: 'Online stores with catalogue, checkout and order management.' },
    { slug: 'business-point-of-sale-systems', name: 'Point-of-sale systems', note: 'Sales, stock and reporting systems for counters and branches.' },
  ]
  return (
    <section className="section section--brand-deep" aria-labelledby="digital-title">
      <div className="container">
        <div className="section-head">
          <div className="section-head__text">
            <p className="t-eyebrow">Digital solutions</p>
            <h2 className="t-h2" id="digital-title">The same studio, working on screen</h2>
            <p className="t-body t-muted t-measure">
              Motion builds the digital side of a brand as well as the printed one — so
              signage, packaging and storefront speak with one voice.
            </p>
          </div>
          <Button to="/services/digital-solutions" variant="text" arrow>Digital services</Button>
        </div>
        <ul className="detail-list">
          {offerings.map(offering => (
            <li key={offering.slug}>
              <Link to={`/services/${offering.slug}`} className="detail-list__row detail-list__row--wide">
                <span className="t-h4">{offering.name}</span>
                <span className="t-body-sm t-muted">{offering.note}</span>
                <Icon name="arrowRight" size={18} className="arrow" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* 7. Process — a numbered typographic list, not a four-icon strip. */
function Process() {
  /* Describes the ordering workflow this application implements — brief, proof
     approval, production, delivery — and nothing about how production is
     organised. Any claim about facilities or capacity belongs to the owner. */
  const steps = [
    { title: 'Discuss', note: 'We agree what the job actually is — sizes, materials, quantities, where it goes and when you need it.' },
    { title: 'Design', note: 'Artwork is prepared or adapted for production, and you approve a proof before anything goes ahead.' },
    { title: 'Produce', note: 'The job moves into production once the proof is approved, and you can follow its status from your account.' },
    { title: 'Deliver', note: 'Finished work is handed over, with installation arranged for the jobs that need it.' },
  ]
  /* Warm off-white rather than the pale blue wash it used to carry. That band
     sat immediately below the deep-blue Digital Solutions section, so the page
     closed on blue, then more blue, then a blue footer. Pale blue is still
     available as a surface; it is simply no longer spent here. */
  return (
    <section className="section section--alt" aria-labelledby="process-title"><div className="container">
      <div className="stack stack--lg">
        <div className="stack" style={{ maxWidth: '34rem' }}>
          <p className="t-eyebrow">How a job runs</p>
          <h2 className="t-h2" id="process-title">Four stages, start to finish</h2>
        </div>
        <ol className="process">
          {steps.map((step, index) => (
            <li className="process__item" key={step.title}>
              <span className="process__num">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="t-h3">{step.title}</h3>
              <p className="t-body-sm t-muted t-measure">{step.note}</p>
            </li>
          ))}
        </ol>
      </div>
      </div>
    </section>
  )
}

/* 8. Contact — restrained close. Every detail is CMS-sourced; unset values are
   simply omitted rather than filled with a plausible-looking placeholder. */
function ContactClose() {
  const { phone, whatsapp, email, address } = useContactDetails()
  const items = [
    phone && { label: 'Call', value: phone, href: `tel:${phone.replace(/\s/g, '')}`, icon: 'phone' },
    whatsapp && { label: 'WhatsApp', value: 'Message us', href: `https://wa.me/${whatsapp.replace(/[^\d]/g, '')}`, icon: 'whatsapp' },
    email && { label: 'Email', value: email, href: `mailto:${email}`, icon: 'mail' },
    address && { label: 'Visit', value: address, icon: 'pin' },
  ].filter(Boolean)

  return (
    <section className="container section rule" aria-labelledby="contact-title">
      <div className="split" style={{ paddingBlockStart: 'var(--space-7)' }}>
        <div className="stack stack--lg">
          <div className="stack">
            <p className="t-eyebrow">Start something</p>
            <h2 className="t-h2" id="contact-title">Tell us what you need made</h2>
          </div>
          <div className="cluster">
            <Button to="/custom-project" variant="primary">Start a custom project</Button>
            <Button to="/quote" variant="secondary">Request a quote</Button>
          </div>
        </div>
        {items.length > 0 ? (
          <div className="contact-grid">
            {items.map(item => (
              <div className="contact-item" key={item.label}>
                <p className="t-eyebrow">{item.label}</p>
                {item.href
                  ? <a href={item.href} className="t-body link">{item.value}</a>
                  : <p className="t-body">{item.value}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="t-body-sm t-muted">
            Contact details appear here once they are published in the admin area.
          </p>
        )}
      </div>
    </section>
  )
}

export function HomePage() {
  return (
    <>
      <Hero />
      <Categories />
      <SelectedWork />
      <FeaturedProducts />
      <CustomProjects />
      <DigitalSolutions />
      <Process />
      <ContactClose />
    </>
  )
}
