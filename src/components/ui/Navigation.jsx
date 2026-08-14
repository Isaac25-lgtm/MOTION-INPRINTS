import { Link } from 'react-router-dom'
import { Icon } from './Icon'

export function Breadcrumbs({ trail = [] }) {
  if (!trail.length) return null
  return (
    <nav aria-label="Breadcrumb">
      <ol className="breadcrumbs">
        <li><Link to="/">Motion</Link></li>
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1
          return (
            <li key={crumb.to || crumb.label} className="cluster" style={{ gap: 'var(--space-2)' }}>
              <span aria-hidden="true">/</span>
              {isLast || !crumb.to
                ? <span aria-current="page">{crumb.label}</span>
                : <Link to={crumb.to}>{crumb.label}</Link>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function Pagination({ offset, limit, count, onChange }) {
  const page = Math.floor(offset / limit) + 1
  const hasPrevious = offset > 0
  const hasNext = count === limit
  if (!hasPrevious && !hasNext) return null
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="btn btn--text" onClick={() => onChange(Math.max(offset - limit, 0))} disabled={!hasPrevious}>
        <Icon name="arrowLeft" size={16} /> Previous
      </button>
      <span className="t-meta">Page {page}</span>
      <button type="button" className="btn btn--text" onClick={() => onChange(offset + limit)} disabled={!hasNext}>
        Next <Icon name="arrowRight" size={16} className="arrow" />
      </button>
    </nav>
  )
}

/* Underlined tabs, used only where content genuinely divides. */
export function Tabs({ tabs = [], value, onChange, label }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map(tab => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

/* Filters as plain text with an underline on the active item — no coloured pills. */
export function FilterBar({ options = [], value, onChange, label = 'Filter' }) {
  return (
    <div className="filters" role="group" aria-label={label}>
      {options.map(option => (
        <button key={option.value ?? 'all'} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}
