import { useState } from 'react'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Form'
import { Breadcrumbs } from '../components/ui/Navigation'
import { Icon } from '../components/ui/Icon'
import { useToast } from '../components/ToastProvider'
import { quoteService } from '../services/quoteService'
import { useContactDetails } from '../content/SiteContentProvider'

/* The contact form submits a quote request — the same workflow the backend already
   models — rather than sending mail from the browser. */
export function ContactPage() {
  const { phone, whatsapp, email, address, mapUrl, hours, social } = useContactDetails()
  const notify = useToast()
  const [form, setForm] = useState({ contactName: '', contactEmail: '', contactPhone: '', projectBrief: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const set = (name) => (event) => setForm(current => ({ ...current, [name]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setErrors({})
    setSubmitting(true)
    try {
      await quoteService.submit(form)
      setSent(true)
      setForm({ contactName: '', contactEmail: '', contactPhone: '', projectBrief: '' })
      notify('Your message has been sent.', 'success')
    } catch (error) {
      // Field-level messages come from the API's validation envelope.
      if (error.details) setErrors(Object.fromEntries(Object.entries(error.details).map(([key, value]) => [key, value[0]])))
      notify(error.message || 'Your message could not be sent.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const channels = [
    phone && { label: 'Phone', value: phone, href: `tel:${phone.replace(/\s/g, '')}`, icon: 'phone' },
    whatsapp && { label: 'WhatsApp', value: 'Send a message', href: `https://wa.me/${whatsapp.replace(/[^\d]/g, '')}`, icon: 'whatsapp' },
    email && { label: 'Email', value: email, href: `mailto:${email}`, icon: 'mail' },
    address && { label: 'Workshop', value: address, href: mapUrl, icon: 'pin' },
  ].filter(Boolean)

  return (
    <div className="container">
      <div className="page-head">
        <Breadcrumbs trail={[{ label: 'Contact' }]} />
        <h1 className="t-h1 page-head__title">Get in touch</h1>
        <p className="t-body-lg t-muted t-measure">
          Tell us what you need produced. For anything measured, fabricated or installed,
          the more detail you give, the faster we can quote it.
        </p>
      </div>

      <div className="section split">
        <div className="stack stack--lg">
          {channels.length > 0 ? (
            <dl className="detail-list">
              {channels.map(channel => (
                <div className="detail-list__row" key={channel.label}>
                  <dt className="cluster"><Icon name={channel.icon} size={16} />{channel.label}</dt>
                  <dd>
                    {channel.href
                      ? <a className="link" href={channel.href} target={channel.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer noopener">{channel.value}</a>
                      : channel.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            /* No contact detail is invented. Until the owner publishes them, the form
               is the working channel and the page says so plainly. */
            <p className="t-body-sm t-muted t-measure">
              Phone, WhatsApp and address details will appear here once they are published
              in the admin area. The form is working in the meantime.
            </p>
          )}

          {hours && (
            <div className="stack stack--sm">
              <p className="t-eyebrow"><Icon name="clock" size={14} /> Opening hours</p>
              {(Array.isArray(hours) ? hours : [hours]).map(line => <p className="t-body-sm" key={line}>{line}</p>)}
            </div>
          )}

          {Array.isArray(social) && social.length > 0 && (
            <div className="stack stack--sm">
              <p className="t-eyebrow">Follow</p>
              <div className="cluster">
                {social.map(account => (
                  <a key={account.url || account.label} className="link t-body-sm" href={account.url} target="_blank" rel="noreferrer noopener">{account.label}</a>
                ))}
              </div>
            </div>
          )}
        </div>

        <form className="stack stack--lg" onSubmit={submit} noValidate>
          <h2 className="t-h3">Send a message</h2>
          {sent && (
            <p className="t-body-sm" role="status" style={{ color: 'var(--state-success)' }}>
              Thank you — your message has been received and we will reply shortly.
            </p>
          )}
          <Field label="Your name" name="contactName" value={form.contactName} onChange={set('contactName')} error={errors.contactName} required autoComplete="name" />
          <Field label="Email" type="email" name="contactEmail" value={form.contactEmail} onChange={set('contactEmail')} error={errors.contactEmail} required autoComplete="email" />
          <Field label="Phone" type="tel" name="contactPhone" value={form.contactPhone} onChange={set('contactPhone')} error={errors.contactPhone} optional autoComplete="tel" />
          <Field
            as="textarea"
            label="What do you need?"
            name="projectBrief"
            value={form.projectBrief}
            onChange={set('projectBrief')}
            error={errors.projectBrief}
            hint="Include sizes, quantities and your deadline if you know them."
            required
          />
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send message'}
          </Button>
        </form>
      </div>
    </div>
  )
}
