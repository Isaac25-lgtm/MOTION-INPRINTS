import { Link } from 'react-router-dom'
import { Frame } from './Media'
import { Price } from './Price'
import { Icon } from './Icon'
import { CategorySpecimen } from '../../features/home/Specimen'
import { resolveCategoryImage } from '../../features/home/placeholderImagery'

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

/* Category card.
 *
 * A photograph when one exists; otherwise a designed print specimen rather than
 * an empty grey box — the catalogue has to look considered before Motion's
 * photography arrives, because that is the state it launches in.
 *
 * The descriptor is the category's real child services joined together. It is
 * never invented copy: if a category has no children, the line is simply absent.
 */
/* Categories that are quoted rather than bought.
 *
 * Digital Solutions has no purchasable products and, being first in the
 * taxonomy, is the first tile a visitor sees. Sending them to /shop/... would
 * open an empty catalogue as the opening move of the site. These route to the
 * services page instead, where the work is described and a quote can be started.
 *
 * Physical categories keep going to the shop. If real digital packages are ever
 * published, remove the slug from this set and the tile routes to the shop like
 * any other. */
const QUOTE_FIRST_CATEGORIES = new Set(['digital-solutions', 'design'])

export const categoryHref = (slug) =>
  QUOTE_FIRST_CATEGORIES.has(slug) ? `/services/${slug}` : `/shop/${slug}`

export function CategoryTile({ category, services = [], ratio = 'landscape' }) {
  const descriptor = services.map(service => service.name).join(' · ')
  /* A real image from the database, else a licensed illustrative photograph
     where one has been verified, else a designed specimen. Categories without a
     suitable verified photograph keep the specimen rather than borrowing an
     unrelated stock image just to fill the grid. */
  const image = resolveCategoryImage(category)
  return (
    <Link
      to={categoryHref(category.slug)}
      className="category-card"
      aria-label={descriptor ? `${category.name}: ${descriptor}` : category.name}
    >
      {image
        ? <Frame src={image.src} alt="" ratio={ratio} sizes="(min-width: 60rem) 30vw, 45vw" />
        : <CategorySpecimen slug={category.slug} />}
      <span className="category-card__body">
        <span className="category-card__name">
          {category.name}
          <Icon name="arrowRight" size={20} className="arrow" />
        </span>
        {/* Real child services, or the category's own description if it has one. */}
        {(descriptor || category.description) && (
          <span className="category-card__services">{descriptor || category.description}</span>
        )}
      </span>
    </Link>
  )
}

export function Badge({ tone, children }) {
  return <span className={['badge', tone && `badge--${tone}`].filter(Boolean).join(' ')}>{children}</span>
}
