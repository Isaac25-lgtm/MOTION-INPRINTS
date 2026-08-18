import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Form'
import { useAuth } from '../auth/AuthProvider'
import { authClient } from '../auth/authClient'

/* Staff password-account setup.
 *
 * Why this exists rather than a "set a password" link:
 *
 *   The /manager page previously offered "Set or reset your staff password",
 *   pointing at the customer reset flow. That was a claim I had not verified.
 *   Better Auth's reset flow acts on an existing password credential; whether it
 *   will mint one for an identity that has only ever signed in with Google is
 *   not documented by Neon and I did not test it — so the page was promising
 *   behaviour that may simply not happen, with no error to explain the silence.
 *
 *   This route makes the same outcome explicit and testable: it creates an
 *   ordinary email-and-password account through the documented sign-up call. If
 *   the address already exists, the message says so and points at the reset flow,
 *   which is well-defined for an account that does have a password.
 *
 * What it deliberately does NOT do:
 *
 *   It grants nothing. No role is sent, none would be accepted, and the page has
 *   no idea whether the address is an owner — the allowlist never reaches the
 *   browser. The result is identical for an approved owner and a stranger: an
 *   account, and an email to verify. Authorisation happens later and elsewhere,
 *   in the server-side staff bootstrap, which is the only thing that can write
 *   the owner role.
 *
 *   So an unapproved person can use this page and end up with exactly what they
 *   would have got from the public sign-up page: a customer account.
 */
export function ManagerActivatePage() {
  const { configured } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    if (form.password !== form.confirm) { setError('The two passwords do not match.'); return }
    if (form.password.length < 12) { setError('Use at least 12 characters for a staff password.'); return }
    setBusy(true); setError(null)
    try {
      await authClient.signUp({ email: form.email, password: form.password, name: form.name })
      setDone(form.email)
    } catch (caught) {
      setError(caught.code === 'email_in_use'
        ? 'An account already exists for that address. Use “Forgotten your password?” on the sign-in page instead.'
        : caught.message)
    } finally { setBusy(false) }
  }

  if (!configured) {
    return (
      <div className="container container--narrow">
        <div className="section stack" style={{ maxWidth: '26rem', marginInline: 'auto' }}>
          <h1 className="t-h2">Staff account setup</h1>
          <p className="t-body-sm t-muted">Not available on this installation.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container container--narrow">
      <div className="section stack stack--lg" style={{ maxWidth: '26rem', marginInline: 'auto' }}>
        <div className="stack">
          <p className="t-eyebrow">Motion</p>
          <h1 className="t-h2">Staff account setup</h1>
          <p className="t-body-sm t-muted">
            Create an email and password sign-in for your Motion staff account.
          </p>
        </div>

        {done ? (
          <div className="state" role="status">
            <p className="t-body">
              We sent a confirmation link to <strong>{done}</strong>. Open it, then sign in.
            </p>
            <p className="t-body-sm t-muted">
              Access is confirmed when you sign in — it is not granted by creating the account.
            </p>
            <Button to="/manager" variant="secondary" size="sm">Go to staff sign in</Button>
          </div>
        ) : (
          <form className="stack" onSubmit={submit} noValidate>
            <Field label="Your name" value={form.name} required autoComplete="name"
              onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <Field label="Email" type="email" hint="Use your Motion staff address." value={form.email} required autoComplete="email"
              onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <Field label="Password" type="password" hint="At least 12 characters." value={form.password} required autoComplete="new-password"
              onChange={(event) => setForm({ ...form, password: event.target.value })} />
            <Field label="Confirm password" type="password" value={form.confirm} required autoComplete="new-password"
              onChange={(event) => setForm({ ...form, confirm: event.target.value })} />
            {error && <p className="field__error" role="alert">{error}</p>}
            <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
            <p className="t-body-sm t-muted">
              Already have one? <Link to="/manager" className="link">Sign in</Link>.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
