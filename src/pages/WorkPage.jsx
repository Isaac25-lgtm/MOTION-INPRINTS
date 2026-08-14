import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Frame, Figure, ImagePair, FullBleed } from '../components/ui/Media'
import { ProjectCard } from '../components/ui/Cards'
import { Async, EmptyState, SkeletonGrid, LoadingState, ErrorState } from '../components/ui/States'
import { Breadcrumbs, FilterBar } from '../components/ui/Navigation'
import { useResource } from '../hooks/useResource'
import { projectService } from '../services/projectService'

const filters = [
  { value: null, label: 'All' },
  { value: 'signage', label: 'Signage' },
  { value: 'printing', label: 'Print' },
  { value: 'apparel', label: 'Apparel' },
  { value: 'promotional-display', label: 'Promotional' },
  { value: 'decor', label: 'Décor' },
  { value: 'digital-solutions', label: 'Digital' },
]

/* Editorial rhythm: the grid varies by position rather than repeating one card
   shape. Index 0 runs full width, then alternating pairs and portrait trios. */
function composition(index) {
  const cycle = index % 6
  if (cycle === 0) return { span: 'full', ratio: 'wide', sizes: '100vw' }
  if (cycle === 1 || cycle === 2) return { span: 'half', ratio: 'landscape', sizes: '(min-width: 48rem) 46vw, 92vw' }
  if (cycle === 3) return { span: 'two-thirds', ratio: 'landscape', sizes: '(min-width: 62rem) 60vw, 92vw' }
  if (cycle === 4) return { span: 'third', ratio: 'portrait', sizes: '(min-width: 62rem) 30vw, 92vw' }
  return { span: 'half', ratio: 'landscape', sizes: '(min-width: 48rem) 46vw, 92vw' }
}

export function WorkPage() {
  const [category, setCategory] = useState(null)
  const state = useResource(({ signal }) => projectService.list({ category, limit: 24 }, { signal }), [category])

  return (
    <div className="container">
      <div className="page-head">
        <Breadcrumbs trail={[{ label: 'Our Work' }]} />
        <h1 className="t-h1 page-head__title">Selected work</h1>
        <p className="t-body-lg t-muted t-measure">
          Signage, print, apparel and display delivered by Motion.
        </p>
      </div>

      <FilterBar options={filters} value={category} onChange={setCategory} label="Filter work by category" />

      <div className="section">
        <Async
          state={state}
          skeleton={<SkeletonGrid count={6} className="grid grid--pair" ratio="4 / 3" />}
          errorTitle="Work could not be loaded"
          empty={(
            <EmptyState
              title={category ? 'No published projects in this category yet' : 'No published projects yet'}
              description="This portfolio is populated from real Motion projects entered in the admin area. Nothing placeholder is shown here on purpose."
              action={<Button to="/custom-project" variant="secondary" size="sm">Start a custom project</Button>}
            />
          )}
        >
          {(projects) => (
            <div className="work-grid">
              {projects.map((project, index) => {
                const layout = composition(index)
                return (
                  <div key={project.id} className={`work-grid__item work-grid__item--${layout.span}`}>
                    <ProjectCard project={project} ratio={layout.ratio} sizes={layout.sizes} priority={index === 0} />
                  </div>
                )
              })}
            </div>
          )}
        </Async>
      </div>
    </div>
  )
}

export function ProjectDetailPage() {
  const { slug } = useParams()
  const state = useResource(({ signal }) => projectService.getBySlug(slug, { signal }), [slug])
  const project = state.data
  const related = useResource(
    ({ signal }) => projectService.list({ category: project?.category_slug, exclude: slug, limit: 3 }, { signal }),
    [project?.category_slug, slug],
    { enabled: Boolean(project) },
  )

  if (state.loading) return <div className="container section"><LoadingState label="Loading project" /></div>
  if (state.error) {
    return (
      <div className="container section">
        <ErrorState title="This project could not be loaded" description={state.error.message} onRetry={state.reload} />
      </div>
    )
  }
  if (!project) return null

  const year = project.completed_on ? new Date(project.completed_on).getFullYear() : null
  const meta = [project.location, year].filter(Boolean).join(' · ')
  const gallery = (project.gallery || []).filter(item => item.image)

  return (
    <article className="container">
      <div className="page-head">
        <Breadcrumbs trail={[{ to: '/work', label: 'Our Work' }, { label: project.title }]} />
        <p className="t-eyebrow">{project.category_name}</p>
        <h1 className="t-h1 page-head__title">{project.title}</h1>
        {meta && <p className="t-body t-muted">{meta}</p>}
      </div>

      <Frame src={project.image} alt={project.title} ratio="wide" priority zoom={false} sizes="100vw" label="Project photograph pending" />

      <div className="section">
        <div className="split">
          <dl className="detail-list split__sticky">
            {project.category_name && (
              <div className="detail-list__row"><dt>Service</dt><dd>{project.category_name}</dd></div>
            )}
            {project.client_name && (
              <div className="detail-list__row"><dt>Client</dt><dd>{project.client_name}</dd></div>
            )}
            {project.location && (
              <div className="detail-list__row"><dt>Location</dt><dd>{project.location}</dd></div>
            )}
            {year && <div className="detail-list__row"><dt>Completed</dt><dd>{year}</dd></div>}
          </dl>
          {project.description
            ? <div className="prose"><p className="t-body-lg">{project.description}</p></div>
            : <p className="t-body-sm t-muted">A written description of this project has not been added yet.</p>}
        </div>
      </div>

      {/* Gallery composition varies with how many photographs exist, rather than
          forcing every project into the same template. */}
      {gallery.length > 0 && (
        <div className="section section--flush-top stack stack--lg">
          {gallery.length === 1 && (
            <FullBleed>
              <Frame src={gallery[0].image} alt={gallery[0].alt} ratio="wide" zoom={false} sharp sizes="100vw" />
            </FullBleed>
          )}
          {gallery.length >= 2 && (
            <ImagePair>
              {gallery.slice(0, 2).map(item => (
                <Frame key={item.image} src={item.image} alt={item.alt} ratio="landscape" zoom={false} sizes="(min-width: 48rem) 46vw, 92vw" />
              ))}
            </ImagePair>
          )}
          {gallery.slice(2).map(item => (
            <Figure key={item.image} caption={item.alt}>
              <Frame src={item.image} alt={item.alt} ratio="wide" zoom={false} sizes="100vw" />
            </Figure>
          ))}
        </div>
      )}

      <section className="section rule">
        <div className="split" style={{ paddingBlockStart: 'var(--space-7)' }}>
          <h2 className="t-h2">Need something similar?</h2>
          <div className="stack">
            <p className="t-body t-muted t-measure">
              Tell us the size, the site and the deadline, and we will quote the job.
            </p>
            <div className="cluster">
              <Button to="/custom-project" variant="primary">Request a quote</Button>
              {project.category_slug && <Button to={`/services/${project.category_slug}`} variant="secondary">About {project.category_name}</Button>}
            </div>
          </div>
        </div>
      </section>

      {/* Secondary section: if related work fails to load it simply does not render,
          rather than putting an error block under a project page. */}
      <Async state={related} skeleton={null} empty={null} errorTitle={null}>
        {(items) => (
          <section className="section section--flush-top" aria-labelledby="related-work">
            <div className="section-head">
              <div className="section-head__text">
                <p className="t-eyebrow">More work</p>
                <h2 className="t-h2" id="related-work">Related projects</h2>
              </div>
            </div>
            <div className="grid grid--trio">
              {items.map(item => <ProjectCard key={item.id} project={item} />)}
            </div>
          </section>
        )}
      </Async>
    </article>
  )
}
