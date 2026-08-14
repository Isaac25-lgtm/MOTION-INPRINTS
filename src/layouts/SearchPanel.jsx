import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Drawer } from '../components/ui/Overlay'
import { Icon } from '../components/ui/Icon'
import { Price } from '../components/ui/Price'
import { searchService } from '../services/searchService'
import { useDebounced, useResource } from '../hooks/useResource'

/* Search returns three clearly separated groups so a visitor can tell a product
   from a service from a completed project at a glance. */
function Group({ label, items, render }) {
  if (!items?.length) return null
  return (
    <section className="search-group">
      <p className="t-eyebrow search-group__label">{label}</p>
      <div>{items.map(render)}</div>
    </section>
  )
}

export function SearchPanel({ open, onClose }) {
  const [term, setTerm] = useState('')
  const debounced = useDebounced(term.trim(), 250)
  const enabled = open && debounced.length >= 2
  const state = useResource(({ signal }) => searchService.query(debounced, { signal }), [debounced], { enabled })
  const results = state.data
  const total = results ? results.products.length + results.services.length + results.projects.length : 0

  const close = () => { setTerm(''); onClose() }

  return (
    <Drawer open={open} onClose={close} title="Search">
      <div className="search-panel">
        <div className="search-field">
          <Icon name="search" size={22} />
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Signage, banners, T-shirts…"
            aria-label="Search products, services and work"
            autoComplete="off"
          />
        </div>

        {term.trim().length > 0 && term.trim().length < 2 && <p className="t-caption">Keep typing to search.</p>}
        {state.loading && <p className="t-caption" role="status">Searching…</p>}
        {state.error && <p className="t-caption" role="alert">Search is unavailable right now.</p>}
        {enabled && !state.loading && !state.error && total === 0 && (
          <p className="t-body-sm t-muted">No matches for “{debounced}”.</p>
        )}

        {results && (
          <div className="stack stack--lg">
            <Group
              label="Products"
              items={results.products}
              render={(item) => (
                <Link key={item.id} to={`/product/${item.slug}`} className="search-result" onClick={close}>
                  <span className="search-result__title">{item.name}</span>
                  <Price amount={item.starting_price} currency={item.currency} pricingType={item.pricing_type} quoteRequired={item.quote_required} />
                </Link>
              )}
            />
            <Group
              label="Services"
              items={results.services}
              render={(item) => (
                <Link key={item.id} to={`/services/${item.slug}`} className="search-result" onClick={close}>
                  <span className="search-result__title">{item.name}</span>
                </Link>
              )}
            />
            <Group
              label="Our work"
              items={results.projects}
              render={(item) => (
                <Link key={item.id} to={`/work/${item.slug}`} className="search-result" onClick={close}>
                  <span className="search-result__title">{item.title}</span>
                  <span className="t-meta">{[item.category_name, item.location].filter(Boolean).join(' · ')}</span>
                </Link>
              )}
            />
          </div>
        )}
      </div>
    </Drawer>
  )
}
