import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Form'
import { useAuth } from '../auth/AuthProvider'
import { authClient } from '../auth/authClient'

/* Set a password for email sign-in, on an identity that already exists.
 *
 * The case this solves: an owner has signed in with Google, so Auth holds
 * their identity with a Google provider and no password. They want the
 * option of email and password as well — one account, two ways in.
 *
 * It uses the password-reset flow deliberately. Reset acts on the EXISTING user
 * rather than creating anything, so the owner keeps a single identity and their
 * Google sign-in continues to work untouched. An earlier version of this page
 * called sign-up instead, which would have produced a second account for the
 * same person — splitting their profile, their orders and their access.
 *
 * The link is emailed to the address itself, which is what makes this safe: it
 * proves control of the mailbox rather than granting anything to whoever asked.
 *
 * What it deliberately does NOT do:
 *
 *   It grants no permission. It sends no role, and none would be accepted. The
 *   page cannot tell whether an address is an owner — the allowlist never
 *   reaches the browser — so the response is identical for an approved owner, an
 *   ordinary customer and an address that does not exist. Authorisation happens
 *   later and elsewhere, in the server-side staff bootstrap, which is the only
 *   thing that can write the owner role.
 *
 * Google stays optional throughout: an owner may use Google only, a password
 * only, or both.
 */
export function ManagerActivatePage() {
  const { configured } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(null)
  const [resent, setResent] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    /* Never reports failure. Saying "no such account" here would turn the page
       into a check for which addresses exist. */
    await authClient.requestPasswordReset({ email, next: '/manager' })
    setSent(email)
    setBusy(false)
  }

  if (!configured) {
    return (
      <div className="container container--narrow">
        <div className="section stack" style={{ maxWidth: '26rem', marginInline: 'auto' }}>
          <h1 className="t-h2">Set a staff password</h1>
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
          <h1 className="t-h2">Set a password for email sign-in</h1>
          <p className="t-body-sm t-muted">
            For a Motion staff account that currently signs in with Google. Your Google
            sign-in keeps working — this adds email and password as a second way in.
          </p>
        </div>

        {sent ? (
          <div className="state" role="status">
            <p className="t-body">
              If <strong>{sent}</strong> belongs to a Motion account, a link to set a password
              is on its way. Open it, choose a password, and you will come back here to sign in.
            </p>
            <p className="t-body-sm t-muted">
              Setting a password does not grant access. Access is confirmed when you sign in.
            </p>
            <div className="cluster">
              <Button to="/manager" variant="secondary" size="sm">Go to staff sign in</Button>
              <Button
                type="button"
                variant="text"
                size="sm"
                onClick={async () => {
                  await authClient.requestPasswordReset({ email: sent, next: '/manager' })
                  setResent(true)
                }}
              >
                Send the link again
              </Button>
            </div>
            {resent && (
              <p className="t-body-sm t-muted" role="status">
                If that address belongs to a Motion account, another link is on its way.
              </p>
            )}
          </div>
        ) : (
          <form className="stack" onSubmit={submit} noValidate>
            <Field
              label="Email"
              type="email"
              hint="The address you already use to sign in to Motion."
              value={email}
              required
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Sending…' : 'Send the link'}
            </Button>
            <p className="t-body-sm t-muted">
              Back to <Link to="/manager" className="link">staff sign in</Link>.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
