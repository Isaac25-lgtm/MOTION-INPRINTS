import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Frame } from '../components/ui/Media'
import { ProductCard, ProjectCard } from '../components/ui/Cards'
import { Async, EmptyState, SkeletonGrid, LoadingState, ErrorState } from '../components/ui/States'
import { Breadcrumbs, FilterBar, Pagination } from '../components/ui/Navigation'
import { useDebounced, useResource } from '../hooks/useResource'
import { useCart } from '../features/cart/CartProvider'
import { useToast } from '../components/ToastProvider'
import { ProductConfigurator } from '../features/products/ProductConfigurator'
import { productService } from '../services/productService'
import { projectService } from '../services/projectService'
import { categoryService } from '../services/categoryService'

const sorts = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'A–Z' },
  { value: 'price-asc', label: 'Price ↑' },
  { value: 'price-desc', label: 'Price ↓' },
]

const LIMIT = 24

export function ShopPage() {
  const { category } = useParams()
  const [sort, setSort] = useState('featured')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const query = useDebounced(search.trim(), 250)
  useEffect(() => setOffset(0), [category])
  const categories = useResource(({ signal }) => categoryService.list({ signal }), [])
  const products = useResource(
    ({ signal }) => productService.list({ category, sort, q: query, limit: LIMIT, offset }, { signal }),
    [category, sort, query, offset],
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

      <div className="catalogue-tools" style={{ paddingBlockEnd: 'var(--space-5)' }}>
        <label className="field catalogue-tools__search">
          <span className="field__label">Search products</span>
          <input
            className="input"
            type="search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setOffset(0) }}
            placeholder="Name or description"
          />
        </label>
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
            title={query ? 'No products match that search' : 'No products listed yet'}
            description={query
              ? 'Try another product name or clear the search.'
              : 'The catalogue is populated from the admin area. Until products are added, request a quote and we will price your job directly.'}
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
  const navigate = useNavigate()
  const { add } = useCart()
  const notify = useToast()
  const [adding, setAdding] = useState(false)
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

  const gallery = [product.image, ...(product.gallery || []).map(item => item.image)].filter(Boolean)

  const addToCart = ({ selection, quantity }) => {
    setAdding(true)
    try {
      add(product, selection, quantity)
      notify(`${product.name} added to your cart.`, 'success')
      navigate('/cart')
    } finally {
      setAdding(false)
    }
  }

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
        <div className="stack">
          <Frame src={product.image} alt={product.name} ratio="square" zoom={false} priority sizes="(min-width: 62rem) 42vw, 92vw" label="Product photograph pending" />
          {gallery.length > 1 && (
            <div className="grid grid--trio">
              {gallery.slice(1, 4).map((image, index) => (
                <Frame key={image} src={image} alt={`${product.name}, view ${index + 2}`} ratio="square" zoom={false} sizes="(min-width: 62rem) 14vw, 30vw" />
              ))}
            </div>
          )}
        </div>

        <div className="stack stack--lg">
          <div className="stack">
            {product.category_name && <p className="t-eyebrow">{product.category_name}</p>}
            <h1 className="t-h1">{product.name}</h1>
            {product.short_description && <p className="t-body-lg t-muted t-measure">{product.short_description}</p>}
          </div>

          {/* Configuration and price come from the backend; this page contains no
              per-product fields and no client-side price arithmetic. */}
          <ProductConfigurator product={product} onAddToCart={addToCart} adding={adding} />

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

          {product.specifications?.length > 0 && (
            <section aria-labelledby="product-specifications">
              <h2 className="t-h3" id="product-specifications">Specifications</h2>
              <dl className="detail-list" style={{ marginBlockStart: 'var(--space-3)' }}>
                {product.specifications.map(item => (
                  <div className="detail-list__row" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </div>

      {product.related_products?.length > 0 && (
        <section className="section rule" aria-labelledby="related-products">
          <div className="section-head" style={{ marginBlockStart: 'var(--space-7)' }}>
            <div className="section-head__text">
              <p className="t-eyebrow">Continue browsing</p>
              <h2 className="t-h2" id="related-products">Related products</h2>
            </div>
          </div>
          <div className="grid grid--products">
            {product.related_products.map(item => <ProductCard key={item.id} product={item} />)}
          </div>
        </section>
      )}

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
