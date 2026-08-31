import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Field, ChoiceGroup } from '../components/ui/Form'
import { Breadcrumbs } from '../components/ui/Navigation'
import { useToast } from '../components/ToastProvider'
import { quoteService } from '../services/quoteService'

/* Project types drive progressive disclosure: each type declares only the extra
   questions it actually needs, so the first screen never asks for dimensions on a
   POS system or artwork on a website enquiry. */
/* Each project type declares the questions it actually needs, so a website
   enquiry is never asked for signage dimensions and a signage enquiry is never
   asked about existing web hosting (Prompt 6.1). */
const projectTypes = [
  /* Digital first, matching the taxonomy. 'Business systems' replaces
     'POS / business system': point of sale is one system Motion can build, and
     naming only that was positioning the business out of everything else. */
  { value: 'website', label: 'Website', extras: ['businessType', 'features', 'existingSite', 'references'] },
  { value: 'ecommerce', label: 'E-commerce website', extras: ['businessType', 'features', 'existingSite', 'references'] },
  { value: 'digital_marketing', label: 'Digital marketing', extras: ['businessType', 'audience', 'channels', 'references'] },
  { value: 'business_systems', label: 'Business systems', extras: ['businessType', 'systemNeed', 'features', 'references'] },
  { value: 'signage', label: 'Signage', extras: ['dimensions', 'placement', 'installation', 'artwork'] },
  { value: 'branding', label: 'Branding', extras: ['artwork'] },
  { value: 'printing', label: 'Printing', extras: ['quantity', 'dimensions', 'artwork'] },
  { value: 'apparel', label: 'Apparel', extras: ['quantity', 'sizes', 'artwork'] },
  { value: 'promotional', label: 'Promotional / display', extras: ['quantity', 'deadline', 'artwork'] },
  { value: 'decor', label: 'Wall décor', extras: ['dimensions', 'installation', 'artwork'] },
  { value: 'other', label: 'Something else', extras: [] },
]

const emptyForm = {
  projectType: '',
  description: '',
  dimensions: '',
  placement: '',
  quantity: '',
  sizes: '',
  installation: '',
  businessType: '',
  audience: '',
  channels: '',
  systemNeed: '',
  features: '',
  existingSite: '',
  references: '',
  completionDate: '',
  preferredContact: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
}

export function CustomProjectPage() {
  const [searchParams] = useSearchParams()
  const notify = useToast()
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [reference, setReference] = useState(null)

  const productHandoff = useMemo(() => {
    const slug = searchParams.get('product')?.trim().slice(0, 200)
    if (!slug) return null
    const name = searchParams.get('productName')?.trim().slice(0, 180) || slug.replace(/-/g, ' ')
    const quantity = Math.max(1, Math.min(1_000_000, Number.parseInt(searchParams.get('quantity') || '1', 10) || 1))
    let configuration = {}
    try {
      const parsed = JSON.parse(searchParams.get('configuration') || '{}')
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        configuration = Object.fromEntries(Object.entries(parsed).slice(0, 30).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value)))
      }
    } catch { /* A malformed URL is treated as having no saved choices. */ }
    return { slug, name, quantity, configuration }
  }, [searchParams])

  const selected = projectTypes.find(type => type.value === form.projectType)
  const extras = selected?.extras || []
  const set = (name) => (event) => setForm((current) => ({ ...current, [name]: event.target.value }))

  /* Type-specific answers are sent as a structured document, so the backend keeps
     them queryable rather than buried in prose. */
  const buildAnswers = () => {
    const answers = {}
    for (const key of extras) if (form[key]) answers[key] = form[key]
    if (productHandoff) {
      answers.productSlug = productHandoff.slug
      answers.productQuantity = productHandoff.quantity
      answers.productConfiguration = JSON.stringify(productHandoff.configuration)
    }
    return answers
  }

  const submit = async (event) => {
    event.preventDefault()
    setErrors({})
    if (!form.projectType) { setErrors({ projectType: 'Choose a project type.' }); return }
    setSubmitting(true)
    try {
      const result = await quoteService.submit({
        projectType: form.projectType,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone || undefined,
        projectBrief: form.description,
        desiredTimeline: form.completionDate || undefined,
        preferredContact: form.preferredContact || undefined,
        answers: buildAnswers(),
      })
      setReference(result.request_number)
      setForm(emptyForm)
      notify('Your project request has been submitted.', 'success')
    } catch (error) {
      if (error.details) setErrors(Object.fromEntries(Object.entries(error.details).map(([key, value]) => [key, value[0]])))
      notify(error.message || 'Your request could not be submitted.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (reference) {
    return (
      <div className="container">
        <div className="page-head">
          <Breadcrumbs trail={[{ label: 'Custom project' }]} />
          <h1 className="t-h1 page-head__title">Request received</h1>
          <p className="t-body-lg t-muted t-measure">
            Your reference is <strong>{reference}</strong>. Keep it — quote it when you contact us.
          </p>
          <div className="cluster">
            <Button to="/work" variant="secondary">See our work</Button>
            <Button onClick={() => setReference(null)} variant="text" arrow>Submit another request</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="page-head">
        <Breadcrumbs trail={[{ label: 'Custom project' }]} />
        <h1 className="t-h1 page-head__title">Start a custom project</h1>
        <p className="t-body-lg t-muted t-measure">
          Two steps: tell us what kind of work it is, then give us the details that
          matter for that kind of work.
        </p>
      </div>

      <form className="section split" onSubmit={submit} noValidate>
        <div className="stack stack--lg split__sticky">
          {productHandoff && (
            <aside className="summary" aria-labelledby="quoted-product">
              <p className="t-eyebrow">Configuration to quote</p>
              <h2 className="t-h4" id="quoted-product">{productHandoff.name}</h2>
              <p className="t-meta">Quantity: {productHandoff.quantity}</p>
              {Object.entries(productHandoff.configuration).map(([key, value]) => (
                <p className="t-meta" key={key}>{key.replace(/_/g, ' ')}: {value === true ? 'yes' : value === false ? 'no' : String(value)}</p>
              ))}
              <p className="t-caption">These choices will be attached to your request. You can add context in the project description.</p>
            </aside>
          )}
          <ChoiceGroup
            legend="What kind of project is it?"
            name="projectType"
            options={projectTypes}
            value={form.projectType}
            onChange={(value) => setForm(current => ({ ...current, projectType: value }))}
          />
          {errors.projectType && <p className="field__error" role="alert">{errors.projectType}</p>}
        </div>

        <div className="stack stack--lg">
          {/* Detail questions appear only once a type is chosen. */}
          {!selected ? (
            <p className="t-body-sm t-muted">Choose a project type to continue.</p>
          ) : (
            <>
              <Field
                as="textarea"
                label="Describe the project"
                value={form.description}
                onChange={set('description')}
                error={errors.projectBrief}
                hint="What is it for, where will it go, and what does it need to say?"
                required
              />

              {extras.includes('dimensions') && (
                <Field label="Approximate dimensions" value={form.dimensions} onChange={set('dimensions')} hint="Width × height, in metres or millimetres." optional />
              )}
              {extras.includes('quantity') && (
                <Field label="Quantity" type="number" min="1" inputMode="numeric" value={form.quantity} onChange={set('quantity')} optional />
              )}
              {extras.includes('sizes') && (
                <Field label="Size breakdown" value={form.sizes} onChange={set('sizes')} hint="For example: 5 × S, 10 × M, 5 × L." optional />
              )}
              {extras.includes('installation') && (
                <Field label="Installation" value={form.installation} onChange={set('installation')} hint="Do you need us to mount or install it, and where?" optional />
              )}
              {extras.includes('placement') && (
                <Field label="Where will it go?" value={form.placement} onChange={set('placement')} hint="Indoors or outdoors, and roughly where on the building." optional />
              )}
              {extras.includes('audience') && (
                <Field label="Who are you trying to reach?" hint="Customers, location, anything that shapes who should see it." value={form.audience} onChange={set('audience')} optional />
              )}
              {extras.includes('channels') && (
                <Field label="Where do you already have a presence?" hint="Social accounts, a website, a mailing list — or none yet." value={form.channels} onChange={set('channels')} optional />
              )}
              {extras.includes('systemNeed') && (
                <Field as="textarea" label="What should the system handle?" hint="For example sales at a counter, stock, reporting across branches. Point of sale is one option among these." value={form.systemNeed} onChange={set('systemNeed')} optional />
              )}
              {extras.includes('businessType') && (
                <Field label="What does the business do?" value={form.businessType} onChange={set('businessType')} optional />
              )}
              {extras.includes('features') && (
                <Field as="textarea" label="What should it do?" value={form.features} onChange={set('features')} hint="For example: online payments, stock tracking, multiple branches." optional />
              )}
              {extras.includes('existingSite') && (
                <Field label="Existing website or system" value={form.existingSite} onChange={set('existingSite')} hint="Paste the address if you have one." optional />
              )}
              {extras.includes('references') && (
                <Field as="textarea" label="Reference links" value={form.references} onChange={set('references')} hint="Existing sites or systems you like." optional />
              )}

              <Field label="Preferred completion date" type="date" value={form.completionDate} onChange={set('completionDate')} optional />

              <div className="field">
                <p className="t-h4">Artwork or reference images</p>
                <p className="t-caption">
                  File uploading is not available yet. Send artwork or reference files directly
                  after you submit this request, quoting the reference we give you.
                </p>
              </div>

              <fieldset className="stack" style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend className="t-h4" style={{ padding: 0, marginBlockEnd: 'var(--space-3)' }}>How do we reach you?</legend>
                <div className="stack">
                  <Field label="Your name" value={form.contactName} onChange={set('contactName')} error={errors.contactName} required autoComplete="name" />
                  <Field label="Email" type="email" value={form.contactEmail} onChange={set('contactEmail')} error={errors.contactEmail} required autoComplete="email" />
                  <Field label="Phone" type="tel" value={form.contactPhone} onChange={set('contactPhone')} error={errors.contactPhone} optional autoComplete="tel" />
                </div>
              </fieldset>

              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit project request'}
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  )
}
