import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Form'
import { Breadcrumbs } from '../components/ui/Navigation'
import { useToast } from '../components/ToastProvider'
import { useAuth } from '../auth/AuthProvider'
import { authClient } from '../auth/authClient'

/* Sign-in, sign-up and password reset against Neon Auth (Managed Better Auth).
 *
 * Two equal ways in: Google, or an email address and a password. Email is a
 * first-class method, not a fallback — any working address is fine (Outlook,
 * Yahoo, Proton, a company or school address, or a Gmail address for someone who
 * would rather hold a separate Motion password than use Google). Nothing here
 * says "Gmail" or requires a Google account.
 *
 * There is no username-only account type. Password recovery, email verification,
 * proof notifications and order updates all need a reachable address.
 *
 * When no auth project is configured these pages say so plainly rather than
 * rendering a form that cannot succeed. Google is only offered when it is
 * actually enabled, so the interface never advertises a provider that will fail.
 */

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

/* Google, then a labelled divider. Rendered only when Google is enabled, so the
   divider never introduces an absent option. */
function GoogleChoice({ label, next, onError }) {
  const { googleEnabled, signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  if (!googleEnabled) return null

  const start = async () => {
    setBusy(true)
    try {
      // Redirects away from the page; nothing after this runs on success.
      await signInWithGoogle({ next })
    } catch (caught) { onError(caught.message); setBusy(false) }
  }

  return (
    <div className="stack">
      <Button type="button" variant="secondary" onClick={start} disabled={busy}>
        {busy ? 'Opening Google…' : 'Continue with Google'}
      </Button>
      <p className="auth-divider" aria-hidden="true"><span>{label}</span></p>
    </div>
  )
}

export function SignInPage() {
  const { signIn, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const notify = useToast()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [unverified, setUnverified] = useState(null)

  if (isAuthenticated) return <Navigate to="/account" replace />

  const justVerified = params.get('verified') === '1'
  const oauthFailed = params.get('error') === 'oauth'

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true); setError(null); setUnverified(null)
    try {
      await signIn(form)
      notify('Signed in.', 'success')
      navigate('/account')
    } catch (caught) {
      /* Verification is a different problem from a wrong password, and the fix
         is different too, so it gets its own state with a resend action. */
      if (caught.code === 'email_not_verified') setUnverified(form.email)
      else setError(caught.message)
    } finally { setBusy(false) }
  }

  const resend = async () => {
    await authClient.resendVerification({ email: unverified })
    notify('If that address needs confirming, a new link is on its way.', 'success')
  }

  return (
    <AuthShell
      title="Sign in"
      intro="Optional. Sign in to see saved details, past orders and quotes, and to approve proofs."
      footer={(
        <p className="t-body-sm t-muted">
          No account? <Link to="/sign-up" className="link">Create one</Link>. You can also{' '}
          <Link to="/track-order" className="link">track an order</Link> without signing in.
        </p>
      )}
    >
      {justVerified && (
        <p className="t-body-sm" role="status" style={{ color: 'var(--state-success)' }}>
          Your email address is confirmed. Sign in below.
        </p>
      )}
      {oauthFailed && (
        <p className="field__error" role="alert">Google sign-in did not complete. Try again, or use your email and password.</p>
      )}

      {/* An account is a convenience, not a gate. Customers can browse, request a
          quote, order and track entirely as guests, and saying so here stops the
          sign-in page reading as a checkout requirement. */}
      <p className="t-body-sm t-muted state" role="note">
        Creating an account is optional. You can browse, request a quote, place an order
        and track it as a guest.
      </p>

      <GoogleChoice label="or sign in with email" next="/account" onError={setError} />

      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required autoComplete="email" />
        <Field label="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required autoComplete="current-password" />

        {/* Deliberately does not distinguish an unknown address from a wrong password. */}
        {error && <p className="field__error" role="alert">{error}</p>}

        {unverified && (
          <div className="state" role="alert">
            <p className="t-body-sm">
              Please confirm your email address first. We sent a link to <strong>{unverified}</strong> when
              the account was created.
            </p>
            <Button type="button" variant="text" size="sm" onClick={resend}>Send the link again</Button>
          </div>
        )}

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
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [checkInbox, setCheckInbox] = useState(null)

  if (isAuthenticated) return <Navigate to="/account" replace />

  const submit = async (event) => {
    event.preventDefault()
    if (form.password !== form.confirm) { setError('The two passwords do not match.'); return }
    if (form.password.length < 8) { setError('Use at least 8 characters.'); return }
    setBusy(true); setError(null)
    try {
      const { verificationRequired } = await signUp({ email: form.email, password: form.password, name: form.name })
      /* With verification enabled the account exists but no session does. Saying
         "account created" and redirecting to the account area would send them
         somewhere they cannot yet reach. */
      if (verificationRequired) setCheckInbox(form.email)
      else { notify('Account created.', 'success'); navigate('/account/profile') }
    } catch (caught) { setError(caught.message) } finally { setBusy(false) }
  }

  if (checkInbox) {
    return (
      <AuthShell title="Confirm your email" intro="One more step before you can sign in.">
        <div className="state" role="status">
          <p className="t-body">
            We sent a confirmation link to <strong>{checkInbox}</strong>. Open it, then sign in.
          </p>
          <p className="t-body-sm t-muted">
            If it has not arrived in a few minutes, check your spam folder.
          </p>
          <div className="cluster">
            <Button to="/sign-in" variant="secondary" size="sm">Go to sign in</Button>
            <Button
              type="button"
              variant="text"
              size="sm"
              onClick={async () => {
                await authClient.resendVerification({ email: checkInbox })
                notify('If that address needs confirming, a new link is on its way.', 'success')
              }}
            >
              Send it again
            </Button>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Create an account"
      intro="Optional. An account keeps your order history, proofs and past jobs in one place."
      footer={<p className="t-body-sm t-muted">Already registered? <Link to="/sign-in" className="link">Sign in</Link>.</p>}
    >
      {/* An account is a convenience, not a gate. Customers can browse, request a
          quote, order and track entirely as guests, and saying so here stops the
          sign-in page reading as a checkout requirement. */}
      <p className="t-body-sm t-muted state" role="note">
        Creating an account is optional. You can browse, request a quote, place an order
        and track it as a guest.
      </p>

      <GoogleChoice label="or create an account with email" next="/account/profile" onError={setError} />

      <form className="stack" onSubmit={submit} noValidate>
        {/* Name is collected here only because Neon Auth accepts one at sign-up.
            Company and phone are profile fields, gathered after authentication. */}
        <Field label="Your name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required autoComplete="name" />
        <Field
          label="Email address"
          type="email"
          hint="Any address you can receive mail at — work, school, Outlook, Yahoo, Proton or Gmail."
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
          autoComplete="email"
        />
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
  /* Better Auth returns the reset credential as `token`. The previous
     integration read `code`, which is Stack's name for it — with that mismatch
     the page would show the request form again instead of the new-password
     form, and the link would appear broken. */
  const token = params.get('token')
  const invalidLink = params.get('error') === 'INVALID_TOKEN'
  const notify = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const requestReset = async (event) => {
    event.preventDefault()
    setBusy(true); setError(null)
    // Never reports failure: doing so would reveal which addresses are registered.
    await authClient.requestPasswordReset({ email })
    setSent(true)
    setBusy(false)
  }

  const applyReset = async (event) => {
    event.preventDefault()
    if (password !== confirm) { setError('The two passwords do not match.'); return }
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    setBusy(true); setError(null)
    try {
      await authClient.resetPassword({ token, password })
      notify('Your password has been changed.', 'success')
      navigate('/sign-in')
    } catch (caught) { setError(caught.message) } finally { setBusy(false) }
  }

  return (
    <AuthShell
      title={token ? 'Choose a new password' : 'Reset your password'}
      intro={token ? 'Enter the new password for your account.' : 'We will email you a link to set a new password.'}
      footer={<p className="t-body-sm t-muted"><Link to="/sign-in" className="link">Back to sign in</Link></p>}
    >
      {invalidLink && (
        <p className="field__error" role="alert">
          That reset link has expired or has already been used. Request a new one below.
        </p>
      )}
      {token ? (
        <form className="stack" onSubmit={applyReset} noValidate>
          <Field label="New password" type="password" hint="At least 8 characters." value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" />
          <Field label="Confirm new password" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required autoComplete="new-password" />
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
