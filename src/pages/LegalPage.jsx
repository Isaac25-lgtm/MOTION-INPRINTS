import { Button } from '../components/ui/Button'
import { Breadcrumbs } from '../components/ui/Navigation'
import { useSiteContent } from '../content/SiteContentProvider'

/* Privacy and terms. Legal text is never written or approximated here — it is
   published by the owner through the CMS. Until then the page says so, which is
   honest and keeps the footer links from resolving to a 404. */
export function LegalPage({ title, section }) {
  const { field } = useSiteContent()
  const body = field(section, 'default', 'body')
  const updated = field(section, 'default', 'updatedOn')

  return (
    <div className="container">
      <div className="page-head">
        <Breadcrumbs trail={[{ label: title }]} />
        <h1 className="t-h1 page-head__title">{title}</h1>
        {updated && <p className="t-meta">Last updated {updated}</p>}
      </div>

      <div className="section section--flush-top">
        {body ? (
          <div className="prose">
            {String(body).split('\n\n').map((paragraph, index) => (
              <p key={index} className={index === 0 ? 't-body-lg' : undefined}>{paragraph}</p>
            ))}
          </div>
        ) : (
          <div className="prose">
            <p className="t-body-lg">
              This policy has not been published yet.
            </p>
            <p className="t-muted">
              Motion has not yet published its {title.toLowerCase()}. No placeholder or
              sample legal text is shown here, because legal wording has to come from
              the business rather than be approximated.
            </p>
            <p className="t-muted">
              If you have a question about how your information is handled, or about the
              terms of a specific job, please get in touch and we will answer directly.
            </p>
            <div className="cluster" style={{ marginBlockStart: 'var(--space-3)' }}>
              <Button to="/contact" variant="secondary">Contact Motion</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
