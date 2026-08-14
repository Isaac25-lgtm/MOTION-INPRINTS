import { useState } from 'react'
import { Button } from '../components/ui/Button'
import { Field, ChoiceGroup } from '../components/ui/Form'
import { Breadcrumbs } from '../components/ui/Navigation'
import { useToast } from '../components/ToastProvider'
import { quoteService } from '../services/quoteService'
import { fileService } from '../services/fileService'

/* Project types drive progressive disclosure: each type declares only the extra
   questions it actually needs, so the first screen never asks for dimensions on a
   POS system or artwork on a website enquiry. */
const projectTypes = [
  { value: 'signage', label: 'Signage', extras: ['dimensions', 'installation', 'artwork'] },
  { value: 'branding', label: 'Branding', extras: ['artwork'] },
  { value: 'printing', label: 'Printing', extras: ['quantity', 'dimensions', 'artwork'] },
  { value: 'apparel', label: 'Apparel', extras: ['quantity', 'sizes', 'artwork'] },
  { value: 'event', label: 'Event materials', extras: ['quantity', 'deadline', 'artwork'] },
  { value: 'decor', label: 'Wall décor', extras: ['dimensions', 'installation', 'artwork'] },
  { value: 'website', label: 'Website', extras: ['references'] },
  { value: 'ecommerce', label: 'E-commerce website', extras: ['references'] },
  { value: 'pos', label: 'POS / business system', extras: ['references'] },
  { value: 'other', label: 'Something else', extras: [] },
]

const emptyForm = {
  projectType: '',
  description: '',
  dimensions: '',
  quantity: '',
  sizes: '',
  installation: '',
  references: '',
  completionDate: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
}

export function CustomProjectPage() {
  const notify = useToast()
  const [form, setForm] = useState(emptyForm)
  const [files, setFiles] = useState([])
  const [fileError, setFileError] = useState(null)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [reference, setReference] = useState(null)

  const selected = projectTypes.find(type => type.value === form.projectType)
  const extras = selected?.extras || []
  const set = (name) => (event) => setForm(current => ({ ...current, [name]: event.target.value }))

  const onFiles = (event) => {
    const chosen = Array.from(event.target.files || [])
    const rejected = chosen.find(file => !fileService.supportedTypes.includes(file.type) || file.size > fileService.maxBytes)
    if (rejected) {
      setFileError(`${rejected.name} was not accepted. Use JPEG, PNG, WebP or PDF up to 25 MB.`)
      setFiles([])
      event.target.value = ''
      return
    }
    setFileError(null)
    setFiles(chosen)
  }

  /* The brief is assembled into the quote_requests record the backend already
     accepts. Uploads are listed by name only until object storage is provisioned;
     nothing pretends a file was stored. */
  const buildBrief = () => {
    const lines = [
      `Project type: ${selected?.label || 'Not specified'}`,
      form.description && `Description: ${form.description}`,
      form.dimensions && `Dimensions: ${form.dimensions}`,
      form.quantity && `Quantity: ${form.quantity}`,
      form.sizes && `Size breakdown: ${form.sizes}`,
      form.installation && `Installation: ${form.installation}`,
      form.references && `References: ${form.references}`,
      form.completionDate && `Preferred completion: ${form.completionDate}`,
      files.length > 0 && `Files the customer intends to send: ${files.map(file => file.name).join(', ')}`,
    ].filter(Boolean)
    return lines.join('\n')
  }

  const submit = async (event) => {
    event.preventDefault()
    setErrors({})
    if (!form.projectType) { setErrors({ projectType: 'Choose a project type.' }); return }
    setSubmitting(true)
    try {
      const result = await quoteService.submit({
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone || undefined,
        projectBrief: buildBrief(),
      })
      setReference(result.request_number)
      setForm(emptyForm)
      setFiles([])
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
            Your reference is <strong>{reference}</strong>. Keep it — you can quote it when
            you contact us, and it will appear in your account once you sign in.
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
              {extras.includes('references') && (
                <Field as="textarea" label="Reference links" value={form.references} onChange={set('references')} hint="Existing sites or systems you like, or your current one." optional />
              )}

              <Field label="Preferred completion date" type="date" value={form.completionDate} onChange={set('completionDate')} optional />

              <div className="field">
                <label className="field__label" htmlFor="artwork">Artwork or reference images <span className="field__optional">(optional)</span></label>
                <p className="field__hint" id="artwork-hint">JPEG, PNG, WebP or PDF, up to 25 MB each.</p>
                <input id="artwork" className="input" type="file" multiple accept={fileService.supportedTypes.join(',')} onChange={onFiles} aria-describedby="artwork-hint artwork-status" />
                <p className="field__hint" id="artwork-status">
                  {files.length > 0
                    ? `${files.length} file${files.length > 1 ? 's' : ''} selected. File uploading is not yet switched on — we will list them with your request and ask you to send them directly.`
                    : 'File uploading is not yet switched on; selected files are recorded by name with your request.'}
                </p>
                {fileError && <p className="field__error" role="alert">{fileError}</p>}
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
