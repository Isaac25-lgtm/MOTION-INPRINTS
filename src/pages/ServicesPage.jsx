import { Link, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Frame } from '../components/ui/Media'
import { ProductCard, ProjectCard } from '../components/ui/Cards'
import { Async, EmptyState, SkeletonGrid, LoadingState, ErrorState } from '../components/ui/States'
import { Breadcrumbs } from '../components/ui/Navigation'
import { Icon } from '../components/ui/Icon'
import { useResource } from '../hooks/useResource'
import { serviceService } from '../services/categoryService'
import { productService } from '../services/productService'
import { projectService } from '../services/projectService'
import { useSiteContent } from '../content/SiteContentProvider'

/* Services are grouped commercially and rendered as a bordered index — a list a
   buyer can scan, rather than a grid of icon boxes. */
function Group({ parent, items }) {
  if (!items.length) return null
  return (
    <section className="service-group section section--tight" aria-labelledby={`group-${parent.slug}`}>
      <div className="stack">
        <h2 className="t-h2" id={`group-${parent.slug}`}>{parent.name}</h2>
        {parent.description && <p className="t-body-sm t-muted t-measure">{parent.description}</p>}
      </div>
      <div className="service-list">
        {items.map(child => (
          <Link key={child.id} to={`/services/${child.slug}`}>
            <span className="service-list__name">{child.name}</span>
            <Icon name="arrowRight" size={18} className="arrow" />
          </Link>
        ))}
      </div>
    </section>
  )
}

export function ServicesPage() {
  const state = useResource(({ signal }) => serviceService.list({ signal }), [])

  return (
    <div className="container">
      <div className="page-head">
        <Breadcrumbs trail={[{ label: 'Services' }]} />
        <h1 className="t-h1 page-head__title">What Motion produces</h1>
        <p className="t-body-lg t-muted t-measure">
          Printing, signage, promotional display, apparel and décor, alongside graphic
          design and the digital systems that carry a brand online.
        </p>
      </div>

      <Async
        state={state}
        skeleton={<LoadingState label="Loading services" />}
        empty={<EmptyState title="No published services yet" description="Publish categories in the admin area and they will be listed here." />}
      >
        {(services) => {
          const parents = services.filter(service => !service.parent_id)
          return (
            <div>
              {parents.map(parent => (
                <Group key={parent.id} parent={parent} items={services.filter(service => service.parent_id === parent.id)} />
              ))}
            </div>
          )
        }}
      </Async>

      <section className="section rule">
        <div className="split" style={{ paddingBlockStart: 'var(--space-7)' }}>
          <div className="stack">
            <p className="t-eyebrow">Not listed?</p>
            <h2 className="t-h2">Most of what we do is made to order</h2>
          </div>
          <div className="stack">
            <p className="t-body t-muted t-measure">
              If the job needs measuring, fabricating or installing, describe it and we
              will quote it.
            </p>
            <div className="cluster">
              <Button to="/custom-project" variant="primary">Start a custom project</Button>
              <Button to="/contact" variant="secondary">Talk to us</Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

/* Individual service page. Cross-links to products in the same category and to
   portfolio projects delivered with that service — explicit relationships, not
   inferred recommendations. */
export function ServiceDetailPage() {
  const { slug } = useParams()
  const { field } = useSiteContent()
  const service = useResource(({ signal }) => serviceService.getBySlug(slug, { signal }), [slug])
  const products = useResource(({ signal }) => productService.list({ category: slug, limit: 8 }, { signal }), [slug])
  const projects = useResource(({ signal }) => projectService.list({ category: slug, limit: 3 }, { signal }), [slug])

  if (service.loading) return <div className="container section"><LoadingState label="Loading service" /></div>
  if (service.error) {
    return (
      <div className="container section">
        <ErrorState title="This service could not be loaded" description={service.error.message} onRetry={service.reload} />
      </div>
    )
  }
  if (!service.data) return null

  const detail = service.data
  const hero = field('service_media', slug, 'image')
  const specifications = field('service_specs', slug, 'rows')

  return (
    <div className="container">
      <div className="page-head">
        <Breadcrumbs trail={[{ to: '/services', label: 'Services' }, { label: detail.name }]} />
        <h1 className="t-h1 page-head__title">{detail.name}</h1>
        {detail.description && <p className="t-body-lg t-muted t-measure">{detail.description}</p>}
        <div className="cluster">
          <Button to="/quote" variant="primary">Request a quote</Button>
          <Button to={`/shop/${slug}`} variant="secondary">See products</Button>
        </div>
      </div>

      <Frame src={hero} alt={`${detail.name} by Motion`} ratio="wide" zoom={false} sizes="100vw" label="Service photograph pending" />

      {Array.isArray(specifications) && specifications.length > 0 && (
        <section className="section section--tight">
          <div className="split">
            <h2 className="t-h3">Specifications</h2>
            <dl className="detail-list">
              {specifications.map(row => (
                <div className="detail-list__row" key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      <section className="section section--tight" aria-labelledby="service-products">
        <div className="section-head">
          <div className="section-head__text">
            <p className="t-eyebrow">Ready to order</p>
            <h2 className="t-h2" id="service-products">{detail.name} products</h2>
          </div>
          <Button to={`/shop/${slug}`} variant="text" arrow>All {detail.name.toLowerCase()}</Button>
        </div>
        <Async
          state={products}
          skeleton={<SkeletonGrid count={4} />}
          empty={<EmptyState title="No products listed for this service yet" description="Request a quote and we will price the job directly." action={<Button to="/quote" variant="secondary" size="sm">Request a quote</Button>} />}
        >
          {(items) => <div className="grid grid--products">{items.map(item => <ProductCard key={item.id} product={item} />)}</div>}
        </Async>
      </section>

      <section className="section section--tight" aria-labelledby="service-work">
        <div className="section-head">
          <div className="section-head__text">
            <p className="t-eyebrow">Delivered</p>
            <h2 className="t-h2" id="service-work">{detail.name} we have produced</h2>
          </div>
          <Button to="/work" variant="text" arrow>All work</Button>
        </div>
        <Async
          state={projects}
          skeleton={<SkeletonGrid count={3} className="grid grid--trio" ratio="4 / 3" />}
          empty={<EmptyState title="No published projects for this service yet" />}
        >
          {(items) => <div className="grid grid--trio">{items.map(item => <ProjectCard key={item.id} project={item} />)}</div>}
        </Async>
      </section>
    </div>
  )
}
