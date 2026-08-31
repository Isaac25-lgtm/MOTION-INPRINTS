import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, SelectField } from '../../components/ui/Form'
import { Badge } from '../../components/ui/Cards'
import { Async, EmptyState, LoadingState } from '../../components/ui/States'
import { AdminNav } from './AdminPages'
import { useToast } from '../../components/ToastProvider'
import { useResource } from '../../hooks/useResource'
import { adminService } from '../../services/adminService'
import { contentService } from '../../services/contentService'
import { env } from '../../config/env'

function Shell({ title, description, children }) {
  return (
    <div className="container container--wide">
      <div className="page-head">
        <h1 className="t-h2 page-head__title">{title}</h1>
        {description && <p className="t-body-sm t-muted t-measure">{description}</p>}
      </div>
      <AdminNav />
      <div className="section section--tight">{children}</div>
    </div>
  )
}

/* ── Website content (Prompt 10.5) ────────────────────────────────────────
   The owner edits copy, media references and contact details. There is
   deliberately no control here for fonts, colours, spacing, radius, animation or
   component placement: the owner controls content, the design system controls
   presentation. That separation is the whole point of this screen. */

const SECTIONS = [
  { section: 'hero', entryKey: 'default', label: 'Homepage hero', fields: ['headline', 'standfirst', 'image', 'imageAlt'] },
  { section: 'announcement', entryKey: 'default', label: 'Announcement bar', fields: ['message', 'href'] },
  { section: 'about', entryKey: 'default', label: 'About page', fields: ['intro', 'body', 'image'] },
  { section: 'contact', entryKey: 'details', label: 'Contact details', fields: ['phone', 'whatsapp', 'email', 'address', 'mapUrl'] },
  { section: 'business_hours', entryKey: 'default', label: 'Opening hours', fields: ['lines'] },
  { section: 'privacy', entryKey: 'default', label: 'Privacy policy', fields: ['body', 'updatedOn'] },
  { section: 'terms', entryKey: 'default', label: 'Terms and conditions', fields: ['body', 'updatedOn'] },
]

const LONG_FIELDS = new Set(['standfirst', 'body', 'intro', 'lines', 'message'])

function ContentSection({ definition, current, onSaved }) {
  const notify = useToast()
  const [values, setValues] = useState(() => Object.fromEntries(
    definition.fields.map(field => [field, current?.value?.[field] ?? '']),
  ))
  const [status, setStatus] = useState(current?.status || 'draft')
  const [publishFrom, setPublishFrom] = useState(current?.publish_from ? String(current.publish_from).slice(0, 16) : '')
  const [publishUntil, setPublishUntil] = useState(current?.publish_until ? String(current.publish_until).slice(0, 16) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const save = async (event) => {
    event.preventDefault()
    setBusy(true); setError(null)
    try {
      await adminService.updateContent(definition.section, {
        entryKey: definition.entryKey,
        // Empty strings are dropped so an unset field stays unset rather than
        // becoming an empty value the public site would render as blank.
        value: Object.fromEntries(Object.entries(values).filter(([, value]) => String(value).trim() !== '')),
        status,
        publishFrom: status === 'scheduled' && publishFrom ? new Date(publishFrom).toISOString() : null,
        publishUntil: publishUntil ? new Date(publishUntil).toISOString() : null,
      })
      notify(`${definition.label} saved.`, 'success')
      onSaved?.()
    } catch (caught) {
      setError(caught.message)
      notify(caught.message || 'That could not be saved.', 'error')
    } finally { setBusy(false) }
  }

  return (
    <details className="content-section">
      <summary className="content-section__summary">
        <span className="t-h4">{definition.label}</span>
        <Badge tone={status === 'published' ? 'success' : status === 'scheduled' ? 'accent' : undefined}>{status}</Badge>
      </summary>
      <form className="stack" onSubmit={save} noValidate>
        {definition.fields.map(field => (
          <Field
            key={field}
            as={LONG_FIELDS.has(field) ? 'textarea' : 'input'}
            label={field.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase())}
            value={values[field]}
            onChange={(event) => setValues({ ...values, [field]: event.target.value })}
            optional
          />
        ))}

        <SelectField
          label="Publication"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={[
            { value: 'draft', label: 'Draft — not visible' },
            { value: 'published', label: 'Published — visible now' },
            { value: 'scheduled', label: 'Scheduled — visible from a date' },
          ]}
        />
        {status === 'scheduled' && (
          <Field label="Visible from" type="datetime-local" value={publishFrom} onChange={(event) => setPublishFrom(event.target.value)} required />
        )}
        <Field label="Hide after" type="datetime-local" value={publishUntil} onChange={(event) => setPublishUntil(event.target.value)} optional hint="Leave blank to keep it visible indefinitely." />

        {error && <p className="field__error" role="alert">{error}</p>}
        <Button type="submit" variant="primary" size="sm" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
      </form>
    </details>
  )
}

export function AdminContentPage() {
  const state = useResource(({ signal }) => contentService.public({ signal }), [])
  const byKey = new Map((state.data || []).map(row => [`${row.section}:${row.entry_key}`, row]))

  return (
    <Shell
      title="Website content"
      description="Wording, media and business details. Presentation is fixed by the design system and is not editable here."
    >
      {state.loading && <LoadingState label="Loading content" />}
      <div className="stack">
        {SECTIONS.map(definition => (
          <ContentSection
            key={`${definition.section}:${definition.entryKey}`}
            definition={definition}
            current={byKey.get(`${definition.section}:${definition.entryKey}`)}
            onSaved={state.reload}
          />
        ))}
      </div>
      <p className="t-caption" style={{ marginBlockStart: 'var(--space-5)' }}>
        Only published entries appear on the site. A scheduled entry becomes visible at its
        start time and disappears at its end time without anything needing to be run.
      </p>
    </Shell>
  )
}

/* ── Media ────────────────────────────────────────────────────────────────
   Public catalogue images and private customer files are kept strictly apart.
   Until something is uploaded through the product/project screens, this is an
   empty library — not a hidden one. */

export function AdminFilesPage() {
  const storageConfigured = Boolean(env.storagePublicBaseUrl)

  return (
    <Shell title="Media" description="Business images and private customer files are kept strictly apart.">
      {!storageConfigured ? (
        <div className="state" role="status">
          <p className="t-h4" style={{ color: 'var(--text)' }}>No storage provider is connected</p>
          <p className="t-body-sm t-measure">
            Uploads, proofs and product photography need an object-storage provider before this
            library can show anything. Nothing is listed here because nothing is stored yet —
            these are not hidden files, they do not exist.
          </p>
          <p className="t-body-sm t-measure">
            Once a provider is configured, public business media and private customer artwork
            appear as separate collections, and a public image can never be created from a
            private customer file.
          </p>
        </div>
      ) : (
        <EmptyState
          title="No media uploaded yet"
          description="Product and project images uploaded through their own screens appear here."
        />
      )}
    </Shell>
  )
}

/* ── Settings (Prompt 10.6/10.7) ──────────────────────────────────────────
   Shows only settings that genuinely exist. No invented toggles, no fabricated
   statistics, and nothing that pretends to control a service that is absent. */

export function AdminSettingsPage() {
  const audit = useResource(({ signal }) => adminService.audit({ limit: 25 }, { signal }), [])

  const facts = [
    { label: 'Currency', value: 'UGX — set in code, applied to every price and total.' },
    { label: 'Tax', value: 'No tax rate is configured. Quotes carry tax only when a rate is set on the individual quote.' },
    { label: 'Delivery pricing', value: 'No delivery rules exist. Checkout confirms delivery cost with the customer separately.' },
    { label: 'Payment provider', value: 'None connected. Online payment is unavailable until one is chosen and configured.' },
    { label: 'Object storage', value: 'Not connected. Artwork and proof files cannot be transferred yet. Send files directly.' },
    { label: 'Customer accounts', value: 'Customers browse, order, inquire and track as guests. There is no customer sign-in.' },
  ]

  return (
    <Shell title="Settings" description="What this installation is currently configured to do.">
      <div className="stack stack--lg">
        <dl className="detail-list">
          {facts.map(fact => (
            <div className="detail-list__row" key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
        <p className="t-caption">
          These reflect environment configuration and are changed by whoever deploys the site,
          not from this screen. Nothing here is editable, because inventing a control for a
          service that is not connected would be worse than showing none.
        </p>

        <section className="stack" aria-labelledby="audit">
          <h2 className="t-h3" id="audit">Recent administrative activity</h2>
          <Async state={audit} skeleton={<LoadingState label="Loading activity" />} empty={<p className="t-body-sm t-muted">No recorded activity yet.</p>}>
            {(rows) => (
              <ul className="stack stack--sm">
                {rows.map((row, index) => (
                  <li key={index} className="attention-row">
                    <span className="t-body-sm">{row.summary || row.action}</span>
                    <span className="t-meta">{new Date(row.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </section>
      </div>
    </Shell>
  )
}
