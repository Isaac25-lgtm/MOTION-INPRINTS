import { Link } from 'react-router-dom'
import { Frame } from './Media'
import { Price } from './Price'
import { Icon } from './Icon'

/* Product: image, name, descriptor, price. No container, no border, no shadow —
   the grid gap does the separating. */
export function ProductCard({ product, sizes = '(min-width: 72rem) 22vw, (min-width: 48rem) 30vw, 45vw' }) {
  return (
    <Link to={`/product/${product.slug}`} className="product">
      <Frame src={product.image} alt={product.name} ratio="square" sizes={sizes} label="Product photograph pending" />
      <div className="product__body">
        <h3 className="product__name">{product.name}</h3>
        {product.short_description && <p className="product__desc">{product.short_description}</p>}
        <div className="product__price">
          <Price
            amount={product.starting_price}
            currency={product.currency}
            pricingType={product.pricing_type}
            quoteRequired={product.quote_required}
          />
        </div>
      </div>
    </Link>
  )
}

/* Project: photography first, one quiet caption line. Never a paragraph over the image. */
export function ProjectCard({ project, ratio = 'landscape', sizes = '(min-width: 62rem) 40vw, 92vw', priority }) {
  const year = project.completed_on ? new Date(project.completed_on).getFullYear() : null
  const meta = [project.category_name, project.location, year].filter(Boolean).join(' · ')
  return (
    <Link to={`/work/${project.slug}`} className="project">
      <Frame src={project.image} alt={project.title} ratio={ratio} sizes={sizes} priority={priority} label="Project photograph pending" />
      <div className="project__caption">
        <h3 className="project__title">{project.title}</h3>
        {meta && <p className="project__meta">{meta}</p>}
      </div>
    </Link>
  )
}

/* Category: a photograph with the name set beneath — not a coloured icon box. */
export function CategoryTile({ category, ratio = 'landscape' }) {
  return (
    <Link to={`/shop/${category.slug}`} className="category">
      <Frame src={category.image} alt={category.name} ratio={ratio} sizes="(min-width: 60rem) 30vw, 45vw" label="Category image pending" />
      <div className="category__name">
        <span>{category.name}</span>
        <Icon name="arrowRight" size={18} className="arrow" />
      </div>
    </Link>
  )
}

export function Badge({ tone, children }) {
  return <span className={['badge', tone && `badge--${tone}`].filter(Boolean).join(' ')}>{children}</span>
}
