import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Form'
import { Breadcrumbs } from '../components/ui/Navigation'
import { useToast } from '../components/ToastProvider'
import { useAuth } from '../auth/AuthProvider'
import { authClient } from '../auth/authClient'

/* Email and password sign-in.
 *
 * Google and other social providers are deliberately absent — Motion asked for
 * password sign-in, and nothing here depends on a social identity.
 *
 * When no authentication project is configured these pages say so plainly rather
 * than rendering a form that cannot succeed. A login box that silently fails is
 * worse than an honest message. */

function AuthShell({ title, intro, children, footer }) {
  const { configured } = useAuth()
  return (
    <div className="container container--narrow">
      <div className="page-head">
        <Breadcrumbs trail={[{ label: title }]} />
        <h1 className="t-h1 page-head__title">{title}</h1>
        {intro && <p className="t-body-lg t-muted t-measure">{intro}</p>}
      </div>
      <div className="section section--flush-top stack stack--lg">
        {!configured ? (
          <div className="state" role="status">
            <p className="t-h4" style={{ color: 'var(--text)' }}>Accounts are not switched on yet</p>
            <p className="t-body-sm t-measure">
              This installation has no authentication project configured, so signing in is not
              possible. You can still browse, order as a guest and track an order with the code
              from your confirmation.
            </p>
            <div className="cluster">
              <Button to="/shop" variant="secondary" size="sm">Continue shopping</Button>
              <Button to="/track-order" variant="text" size="sm" arrow>Track an order</Button>
            </div>
          </div>
        ) : children}
        {configured && footer}
      </div>
    </div>
  )
}

export function SignInPage() {
  const { signIn, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const notify = useToast()
  const [form, setForm] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (isAuthenticated) return <Navigate to="/account" replace />

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true); setError(null)
    try {
      await signIn(form)
      notify('Signed in.', 'success')
      navigate('/account')
    } catch (caught) {
      // Deliberately does not distinguish unknown email from wrong password.
      setError(caught.message)
    } finally { setBusy(false) }
  }

  return (
    <AuthShell
      title="Sign in"
      intro="Access your orders, quotes and design proofs."
      footer={(
        <p className="t-body-sm t-muted">
          No account? <Link to="/sign-up" className="link">Create one</Link>. You can also{' '}
          <Link to="/track-order" className="link">track an order</Link> without signing in.
        </p>
      )}
    >
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required autoComplete="email" />
        <Field label="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required autoComplete="current-password" />
        {error && <p className="field__error" role="alert">{error}</p>}
        <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        <Link to="/reset-password" className="t-body-sm link">Forgotten your password?</Link>
      </form>
    </AuthShell>
  )
}

export function SignUpPage() {
  const { signUp, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const notify = useToast()
  const [form, setForm] = useState({ email: '', password: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (isAuthenticated) return <Navigate to="/account" replace />

  const submit = async (event) => {
    event.preventDefault()
    if (form.password !== form.confirm) { setError('The two passwords do not match.'); return }
    if (form.password.length < 8) { setError('Use at least 8 characters.'); return }
    setBusy(true); setError(null)
    try {
      await signUp({ email: form.email, password: form.password })
      notify('Account created.', 'success')
      navigate('/account/profile')
    } catch (caught) { setError(caught.message) } finally { setBusy(false) }
  }

  return (
    <AuthShell
      title="Create an account"
      intro="Keep your order history, approve proofs and reorder past jobs."
      footer={<p className="t-body-sm t-muted">Already registered? <Link to="/sign-in" className="link">Sign in</Link>.</p>}
    >
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required autoComplete="email" />
        <Field label="Password" type="password" hint="At least 8 characters." value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required autoComplete="new-password" />
        <Field label="Confirm password" type="password" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} required autoComplete="new-password" />
        {error && <p className="field__error" role="alert">{error}</p>}
        <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
      </form>
    </AuthShell>
  )
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const code = params.get('code')
  const notify = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const requestReset = async (event) => {
    event.preventDefault()
    setBusy(true); setError(null)
    try {
      await authClient.requestPasswordReset({ email })
      // Reported identically whether or not the account exists, so this cannot be
      // used to discover which addresses are registered.
      setSent(true)
    } catch (caught) { setError(caught.message) } finally { setBusy(false) }
  }

  const applyReset = async (event) => {
    event.preventDefault()
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    setBusy(true); setError(null)
    try {
      await authClient.resetPassword({ code, password })
      notify('Your password has been changed.', 'success')
      navigate('/sign-in')
    } catch (caught) { setError(caught.message) } finally { setBusy(false) }
  }

  return (
    <AuthShell
      title={code ? 'Choose a new password' : 'Reset your password'}
      intro={code ? 'Enter the new password for your account.' : 'We will email you a link to set a new password.'}
      footer={<p className="t-body-sm t-muted"><Link to="/sign-in" className="link">Back to sign in</Link></p>}
    >
      {code ? (
        <form className="stack" onSubmit={applyReset} noValidate>
          <Field label="New password" type="password" hint="At least 8 characters." value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" />
          {error && <p className="field__error" role="alert">{error}</p>}
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</Button>
        </form>
      ) : sent ? (
        <p className="t-body" role="status">
          If that address has an account, a reset link is on its way. Check your inbox.
        </p>
      ) : (
        <form className="stack" onSubmit={requestReset} noValidate>
          <Field label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          {error && <p className="field__error" role="alert">{error}</p>}
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Button>
        </form>
      )}
    </AuthShell>
  )
}
