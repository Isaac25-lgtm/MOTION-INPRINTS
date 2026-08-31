import { Button } from '../components/ui/Button'
import { Frame } from '../components/ui/Media'
import { ProjectCard } from '../components/ui/Cards'
import { Async, SkeletonGrid } from '../components/ui/States'
import { Breadcrumbs } from '../components/ui/Navigation'
import { useResource } from '../hooks/useResource'
import { projectService } from '../services/projectService'
import { useSiteContent } from '../content/SiteContentProvider'

/* Every factual claim about the company would have to come from the CMS.
   Nothing here states a founding year, client count, project count, award,
   staff size or company history, because none of that has been verified. */

/* Ordered as the taxonomy is: digital first. Descriptive only — no claim about
   facilities, capacity or scale, which are the owner's to make through the CMS. */
const capabilities = [
  { title: 'Digital solutions', note: 'Websites, e-commerce stores, digital marketing and business systems — scoped and quoted per project.' },
  { title: 'Printing', note: 'Digital, UV, sublimation and offset printing for commercial and promotional work.' },
  { title: 'Signage', note: '2D and 3D signage, lightboxes, pylons and acrylic signs — fabricated and installed.' },
  { title: 'Promotional & display', note: 'Pull-up banners, teardrops, stickers and promotional items.' },
  { title: 'Branded apparel', note: 'T-shirts, caps and bucket hats branded by print or embroidery.' },
  { title: 'Wall décor', note: 'Canvas, glass and acrylic wall pieces, finished and mounted.' },
  { title: 'Graphic design', note: 'Identity, layout and artwork prepared for production.' },
]

export function AboutPage() {
  const { field } = useSiteContent()
  const intro = field('about', 'default', 'intro')
  const body = field('about', 'default', 'body')
  const image = field('about', 'default', 'image')
  const projects = useResource(({ signal }) => projectService.list({ limit: 3, featured: 'true' }, { signal }), [])

  return (
    <div className="container">
      <div className="page-head">
        <Breadcrumbs trail={[{ label: 'About' }]} />
        <h1 className="t-h1 page-head__title">A digital and production studio in Kampala</h1>
        <p className="t-body-lg t-muted t-measure">
          {intro || 'Motion builds the digital side of a brand and produces the physical materials it is recognised by — websites, e-commerce, digital marketing and business systems, alongside signage, commercial print and branded products.'}
        </p>
      </div>

      <Frame src={image} alt="Motion workshop" ratio="wide" zoom={false} sizes="100vw" label="Workshop photograph pending" />

      <section className="section">
        <div className="split">
          <div className="stack">
            <p className="t-eyebrow">How we work</p>
            <h2 className="t-h2">From brief to finished work</h2>
          </div>
          {/* The fallback describes only how ordering works in this application.
              Claims about facilities, history or capacity are the owner's to make
              and belong in the CMS `about` entry, which replaces this entirely. */}
          <div className="prose">
            {body
              ? <p className="t-body-lg">{body}</p>
              : (
                <>
                  <p className="t-body-lg">
                    Most of what we make is specific to one business and one place: a sign
                    sized for a particular shopfront, a print run for a particular event, a
                    uniform for a particular team.
                  </p>
                  <p>
                    Straightforward items can be ordered directly from the shop. Anything that
                    needs measuring, making or installing is quoted first, so the price
                    reflects the actual job rather than an approximation.
                  </p>
                  <p>
                    You approve a proof before a job goes into production, and you can follow
                    its progress with the tracking code from your confirmation.
                  </p>
                </>
              )}
          </div>
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="capabilities">
        <div className="section-head">
          <div className="section-head__text">
            <p className="t-eyebrow">Capabilities</p>
            <h2 className="t-h2" id="capabilities">What we build and produce</h2>
          </div>
          <Button to="/services" variant="text" arrow>All services</Button>
        </div>
        <dl className="detail-list">
          {capabilities.map(capability => (
            <div className="detail-list__row" key={capability.title}>
              <dt className="t-h4" style={{ color: 'var(--text)' }}>{capability.title}</dt>
              <dd className="t-muted">{capability.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Async state={projects} skeleton={<SkeletonGrid count={3} className="grid grid--trio" ratio="4 / 3" />} empty={null} errorTitle={null}>
        {(items) => (
          <section className="section section--tight" aria-labelledby="about-work">
            <div className="section-head">
              <div className="section-head__text">
                <p className="t-eyebrow">Recent</p>
                <h2 className="t-h2" id="about-work">Work we have delivered</h2>
              </div>
              <Button to="/work" variant="text" arrow>All work</Button>
            </div>
            <div className="grid grid--trio">{items.map(item => <ProjectCard key={item.id} project={item} />)}</div>
          </section>
        )}
      </Async>

      <section className="section section--alt bleed">
        <div className="container split">
          <h2 className="t-h2">Work with Motion</h2>
          <div className="cluster">
            <Button to="/custom-project" variant="primary">Start a custom project</Button>
            <Button to="/contact" variant="secondary">Contact us</Button>
          </div>
        </div>
      </section>
    </div>
  )
}
