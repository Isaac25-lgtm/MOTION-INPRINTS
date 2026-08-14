import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Frame } from '../components/ui/Media'
import { ProductCard, ProjectCard } from '../components/ui/Cards'
import { Price } from '../components/ui/Price'
import { Async, EmptyState, SkeletonGrid, LoadingState, ErrorState } from '../components/ui/States'
import { Breadcrumbs, FilterBar, Pagination } from '../components/ui/Navigation'
import { QuantityControl } from '../components/ui/Form'
import { useResource } from '../hooks/useResource'
import { productService } from '../services/productService'
import { projectService } from '../services/projectService'
import { categoryService } from '../services/categoryService'

const sorts = [
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'A–Z' },
  { value: 'price-asc', label: 'Price ↑' },
  { value: 'price-desc', label: 'Price ↓' },
]

const LIMIT = 24

export function ShopPage() {
  const { category } = useParams()
  const [sort, setSort] = useState('newest')
  const [offset, setOffset] = useState(0)
  const categories = useResource(({ signal }) => categoryService.list({ signal }), [])
  const products = useResource(
    ({ signal }) => productService.list({ category, sort, limit: LIMIT, offset }, { signal }),
    [category, sort, offset],
  )
  const active = categories.data?.find(item => item.slug === category)

  return (
    <div className="container">
      <div className="page-head">
        <Breadcrumbs trail={[{ to: '/shop', label: 'Shop' }, ...(active ? [{ label: active.name }] : [])]} />
        <h1 className="t-h1 page-head__title">{active ? active.name : 'Shop'}</h1>
        {active?.description
          ? <p className="t-body-lg t-muted t-measure">{active.description}</p>
          : <p className="t-body-lg t-muted t-measure">Products that can be ordered directly. Anything made to measure is quoted instead.</p>}
      </div>

      <div className="cluster cluster--between" style={{ paddingBlockEnd: 'var(--space-5)' }}>
        <FilterBar
          options={sorts}
          value={sort}
          onChange={(value) => { setSort(value); setOffset(0) }}
          label="Sort products"
        />
      </div>

      <Async
        state={products}
        skeleton={<SkeletonGrid count={8} />}
        errorTitle="Products could not be loaded"
        empty={(
          <EmptyState
            title="No products listed yet"
            description="The catalogue is populated from the admin area. Until products are added, request a quote and we will price your job directly."
            action={<Button to="/quote" variant="secondary" size="sm">Request a quote</Button>}
          />
        )}
      >
        {(items) => (
          <>
            <div className="grid grid--products">
              {items.map(product => <ProductCard key={product.id} product={product} />)}
            </div>
            <Pagination offset={offset} limit={LIMIT} count={items.length} onChange={setOffset} />
          </>
        )}
      </Async>
    </div>
  )
}

export function ProductDetailPage() {
  const { slug } = useParams()
  const [quantity, setQuantity] = useState(1)
  const state = useResource(({ signal }) => productService.getBySlug(slug, { signal }), [slug])
  const product = state.data

  /* Cross-link: portfolio work delivered in this product's category. */
  const related = useResource(
    ({ signal }) => projectService.list({ category: product?.category_slug, limit: 3 }, { signal }),
    [product?.category_slug],
    { enabled: Boolean(product?.category_slug) },
  )

  if (state.loading) return <div className="container section"><LoadingState label="Loading product" /></div>
  if (state.error) {
    return (
      <div className="container section">
        <ErrorState title="This product could not be loaded" description={state.error.message} onRetry={state.reload} />
      </div>
    )
  }
  if (!product) return null

  const quoteOnly = product.quote_required || product.pricing_type === 'quote_only'

  return (
    <div className="container">
      <div style={{ paddingBlockStart: 'var(--space-5)' }}>
        <Breadcrumbs
          trail={[
            { to: '/shop', label: 'Shop' },
            ...(product.category_slug ? [{ to: `/shop/${product.category_slug}`, label: product.category_name }] : []),
            { label: product.name },
          ]}
        />
      </div>

      <div className="section split">
        <Frame src={product.image} alt={product.name} ratio="square" zoom={false} priority sizes="(min-width: 62rem) 42vw, 92vw" label="Product photograph pending" />

        <div className="stack stack--lg">
          <div className="stack">
            {product.category_name && <p className="t-eyebrow">{product.category_name}</p>}
            <h1 className="t-h1">{product.name}</h1>
            {product.short_description && <p className="t-body-lg t-muted t-measure">{product.short_description}</p>}
          </div>

          <Price
            amount={product.starting_price}
            currency={product.currency}
            pricingType={product.pricing_type}
            quoteRequired={product.quote_required}
          />

          {/* Configurable and quote-only items route to the quotation workflow rather
              than pretending a cart price exists. */}
          {quoteOnly ? (
            <div className="stack">
              <p className="t-body-sm t-muted t-measure">
                This item is quoted individually — the price depends on size, material,
                finishing and quantity.
              </p>
              <Button to="/custom-project" variant="primary">Request a quote</Button>
            </div>
          ) : (
            <div className="stack">
              <QuantityControl value={quantity} onChange={setQuantity} />
              <Button variant="primary" disabled aria-disabled="true">Add to cart</Button>
              <p className="t-caption">
                Ordering opens once checkout and payment are switched on. In the meantime,
                request a quote and we will confirm price and lead time.
              </p>
              <Button to="/quote" variant="text" arrow>Request a quote</Button>
            </div>
          )}

          {product.description && (
            <div className="prose rule" style={{ paddingBlockStart: 'var(--space-5)' }}>
              <p>{product.description}</p>
            </div>
          )}

          {product.production_lead_time && (
            <dl className="detail-list">
              <div className="detail-list__row"><dt>Production time</dt><dd>{product.production_lead_time}</dd></div>
            </dl>
          )}
        </div>
      </div>

      <Async state={related} skeleton={null} empty={null} errorTitle={null}>
        {(items) => (
          <section className="section rule" aria-labelledby="product-work">
            <div className="section-head" style={{ marginBlockStart: 'var(--space-7)' }}>
              <div className="section-head__text">
                <p className="t-eyebrow">Related work</p>
                <h2 className="t-h2" id="product-work">{product.category_name} we have produced</h2>
              </div>
              <Button to="/work" variant="text" arrow>All work</Button>
            </div>
            <div className="grid grid--trio">{items.map(item => <ProjectCard key={item.id} project={item} />)}</div>
          </section>
        )}
      </Async>
    </div>
  )
}
