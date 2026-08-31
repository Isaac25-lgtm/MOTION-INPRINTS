import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Form'
import { useAdminSession } from '../auth/AdminSessionProvider'

const REFUSED = 'Those details do not match a Motion staff account.'

export function ManagerSignInPage() {
  const { isOwner, signIn } = useAdminSession()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (isOwner) return <Navigate to="/manager/dashboard" replace />

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(form)
      navigate('/manager/dashboard', { replace: true })
    } catch {
      setError(REFUSED)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container container--narrow">
      <div className="section stack stack--lg" style={{ maxWidth: '26rem', marginInline: 'auto' }}>
        <div className="stack">
          <p className="t-eyebrow">Motion</p>
          <h1 className="t-h2">Staff sign in</h1>
          <p className="t-body-sm t-muted">Management access for Motion staff.</p>
        </div>

        <form className="stack" onSubmit={submit} noValidate>
          <Field
            label="Username"
            value={form.username}
            required
            autoComplete="username"
            onChange={(event) => setForm({ ...form, username: event.target.value })}
          />
          <Field
            label="Password"
            type="password"
            value={form.password}
            required
            autoComplete="current-password"
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          {error && <p className="field__error" role="alert">{error}</p>}
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
      </div>
    </div>
  )
}
