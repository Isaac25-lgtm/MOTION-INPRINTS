import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Form'
import { LoadingState } from '../components/LoadingState'
import { useAuth } from '../auth/AuthProvider'
import { authClient } from '../auth/authClient'
import { staffService } from '../services/staffService'

/* Motion staff sign-in.
 *
 * Reached only by typing /manager. It is not linked from the header, the footer,
 * the customer account area, navigation or any marketing content — but that is
 * obscurity, not security, and nothing here relies on it. Every management API
 * independently verifies the session and the stored role, so knowing the URL
 * gains an unauthorised visitor precisely nothing.
 *
 * The wording is deliberately separate from the customer pages. No "create an
 * account", no "optional", no reassurance about guest checkout: a person who
 * arrives here either has staff access or should not be encouraged to want it.
 *
 * How access is actually granted:
 *
 *   Signing in proves identity. It does not grant anything. After a session
 *   exists, the browser asks the API to bootstrap staff access; the server
 *   resolves the email from Supabase Auth using the verified token, checks it
 *   against a server-only allowlist, and only then writes the owner role. The
 *   browser never sends an email, a role or an "is owner" flag, and would not
 *   be believed if it did.
 */

/** Neutral for every refusal: unknown, unverified and not-an-owner look identical. */
const REFUSED = 'This account is not authorised for Motion staff access.'

export function ManagerSignInPage() {
  const { configured, googleEnabled, isAuthenticated, isOwner, signIn, signInWithGoogle, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(false)
  const [unverified, setUnverified] = useState(null)
  const [resent, setResent] = useState(false)

  /* Runs after any successful sign-in, and on arrival back from Google. Asking
     twice is harmless — the server upsert is idempotent. */
  const bootstrap = useCallback(async () => {
    setChecking(true)
    setError(null)
    try {
      await staffService.bootstrap()
      await refreshProfile()
      navigate('/manager/dashboard', { replace: true })
    } catch (caught) {
      setError(caught.status === 403 ? REFUSED : 'Staff access could not be confirmed. Please try again.')
    } finally { setChecking(false) }
  }, [navigate, refreshProfile])

  /* Google returns to this page with a session already established, so there is
     no code to exchange — the session simply exists and this picks it up. */
  useEffect(() => {
    if (isAuthenticated && !isOwner && !checking) { bootstrap() }
    // Intentionally not depending on `checking`, which would re-enter the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isOwner])

  if (isOwner) return <Navigate to="/manager/dashboard" replace />

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true); setError(null); setUnverified(null); setResent(false)
    try {
      await signIn(form)
      await bootstrap()
    } catch (caught) {
      /* An unconfirmed address is a different problem from a wrong password and
         has a different fix, so it gets its own state with a resend action.
         Everything else stays one flat message that never distinguishes an
         unknown address from a wrong password, and never reveals whether the
         address belongs to staff. */
      if (caught.code === 'email_not_verified') setUnverified(form.email)
      else setError('Those details do not match a Motion staff account.')
    } finally { setBusy(false) }
  }

  /* Returns to /manager rather than the customer sign-in page — an owner
     confirming their address must land back in the staff flow. The response is
     identical whether or not the address needs confirming. */
  const resend = async () => {
    await authClient.resendVerification({ email: unverified, next: '/manager' })
    setResent(true)
  }

  const google = async () => {
    setBusy(true); setError(null)
    try { await signInWithGoogle({ next: '/manager' }) }
    catch { setError('Google sign-in could not be started. Try your email and password instead.'); setBusy(false) }
  }

  return (
    <div className="container container--narrow">
      <div className="section stack stack--lg" style={{ maxWidth: '26rem', marginInline: 'auto' }}>
        <div className="stack">
          <p className="t-eyebrow">Motion</p>
          <h1 className="t-h2">Staff sign in</h1>
          <p className="t-body-sm t-muted">Management access for Motion staff.</p>
        </div>

        {!configured ? (
          <div className="state" role="status">
            <p className="t-body-sm">Staff sign-in is not available on this installation.</p>
          </div>
        ) : checking ? (
          <LoadingState label="Confirming staff access" />
        ) : (
          <>
            {googleEnabled && (
              <div className="stack">
                <Button type="button" variant="secondary" onClick={google} disabled={busy}>
                  {busy ? 'Opening Google…' : 'Continue with Google'}
                </Button>
                <p className="auth-divider" aria-hidden="true"><span>or use your email</span></p>
              </div>
            )}

            <form className="stack" onSubmit={submit} noValidate>
              <Field label="Email" type="email" value={form.email} required autoComplete="email"
                onChange={(event) => setForm({ ...form, email: event.target.value })} />
              <Field label="Password" type="password" value={form.password} required autoComplete="current-password"
                onChange={(event) => setForm({ ...form, password: event.target.value })} />
              {error && <p className="field__error" role="alert">{error}</p>}

              {unverified && (
                <div className="state" role="alert">
                  <p className="t-body-sm">
                    Confirm your email address first. We sent a link when the account was created.
                  </p>
                  <Button type="button" variant="text" size="sm" onClick={resend}>Send the link again</Button>
                  {resent && (
                    <p className="t-body-sm t-muted" role="status">
                      If that address still needs confirming, a new link is on its way.
                    </p>
                  )}
                </div>
              )}

              <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
            </form>

            {/* Both go through the reset flow, which acts on an identity that
                already exists — so an owner who has only ever used Google gains a
                password on the SAME account rather than a second one. The two
                entry points differ only in wording, because "set" and "forgotten"
                are different problems to the person reading them. */}
            <p className="t-body-sm t-muted">
              <Link className="link" to="/manager/activate">Set password for email sign-in</Link>
              {' · '}
              <Link className="link" to="/reset-password?next=%2Fmanager">Forgotten your password?</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
