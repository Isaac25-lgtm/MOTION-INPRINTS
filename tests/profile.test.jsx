// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

/* First-profile onboarding.
 *
 * The defect this covers: a newly authenticated customer has a Neon Auth
 * identity but no `public.user_profiles` row. The route guard sends them to
 * /account/profile, `GET /me` answers 403 `profile_required`, and the page
 * rendered a dead error with a Retry button that could only produce the same 403.
 * `POST /me` and a `createProfile` service both existed and neither was wired to
 * anything. That blocked every new customer — and the owner bootstrap with them,
 * since the promotion script refuses to run without a profile row.
 *
 * These run in jsdom rather than the SSR renderer the rest of the suite uses,
 * because the behaviour under test is what happens when the fetch rejects and
 * when the form is submitted. Neither survives `renderToStaticMarkup`, which
 * never runs an effect or a handler.
 */

const calls = []
let nextProfile

vi.mock('../src/services/apiClient.js', () => {
  class ApiClientError extends Error {
    constructor(message, { status, code, details } = {}) {
      super(message); this.name = 'ApiClientError'; this.status = status; this.code = code; this.details = details
    }
  }
  return {
    ApiClientError,
    setAuthTokenProvider: () => {},
    request: async (path, options = {}) => {
      const method = options.method || 'GET'
      calls.push({ path, method, body: options.body })
      if (path === '/me' && method === 'GET') {
        if (nextProfile) return nextProfile
        throw new ApiClientError('A customer profile is required.', { status: 403, code: 'profile_required' })
      }
      if (path === '/me' && method === 'POST') {
        nextProfile = { id: 'p-new', auth_user_id: 'auth-1', role: 'customer', full_name: options.body.fullName, phone: null, company_name: null }
        return nextProfile
      }
      if (path === '/me' && method === 'PATCH') {
        nextProfile = { ...nextProfile, full_name: options.body.fullName }
        return nextProfile
      }
      return []
    },
  }
})

const refreshProfile = vi.fn(async () => {})
let authUser = { id: 'auth-1', name: 'Amina Nakato' }

vi.mock('../src/auth/AuthProvider.jsx', () => ({
  useAuth: () => ({ user: authUser, profile: nextProfile || null, refreshProfile, status: 'authenticated' }),
  AuthProvider: ({ children }) => children,
}))

vi.mock('../src/components/ToastProvider.jsx', () => ({
  useToast: () => () => {},
  ToastProvider: ({ children }) => children,
}))

const { AccountProfilePage } = await import('../src/pages/account/AccountPages.jsx')

/** Mounts the page and lets its effects settle. */
async function mount() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(<StrictMode><MemoryRouter><AccountProfilePage /></MemoryRouter></StrictMode>)
  })
  // Let the rejected fetch resolve into state.
  await act(async () => { await Promise.resolve() })
  return { container, root }
}

const field = (container, label) => [...container.querySelectorAll('label')]
  .find(node => node.textContent.includes(label))
  ?.closest('.field')?.querySelector('input')

async function type(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  await act(async () => {
    setter.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

beforeEach(() => {
  calls.length = 0
  nextProfile = null
  refreshProfile.mockClear()
  authUser = { id: 'auth-1', name: 'Amina Nakato' }
  document.body.innerHTML = ''
})

describe('first profile after sign-up', () => {
  it('treats a missing profile as onboarding, not as a failed request', async () => {
    const { container } = await mount()
    const text = container.textContent

    // The onboarding form, not an error with a Retry that cannot succeed.
    expect(text).toContain('Complete your profile')
    expect(text, 'a missing profile is not a load failure').not.toContain('could not be loaded')
    expect(container.querySelector('form'), 'expected a usable form').toBeTruthy()
    expect(container.textContent).toContain('Save and continue')
  })

  it('prefills the name from the Neon Auth identity without requiring one', async () => {
    const withName = await mount()
    expect(field(withName.container, 'Full name').value).toBe('Amina Nakato')

    // An identity with no name still gets a usable, empty form.
    document.body.innerHTML = ''
    authUser = { id: 'auth-1' }
    const withoutName = await mount()
    expect(field(withoutName.container, 'Full name').value).toBe('')
    expect(withoutName.container.querySelector('form')).toBeTruthy()
  })

  it('creates the profile with POST /me and refreshes the session', async () => {
    const { container } = await mount()

    await type(field(container, 'Full name'), 'Amina Nakato')
    await type(field(container, 'Phone number'), '+256 700 000000')
    await act(async () => {
      container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    })

    const post = calls.find(c => c.path === '/me' && c.method === 'POST')
    expect(post, 'the form must create the profile with POST /me').toBeTruthy()
    expect(post.body.fullName).toBe('Amina Nakato')
    expect(post.body.phone).toBe('+256 700 000000')

    // No PATCH — there is nothing to patch yet.
    expect(calls.some(c => c.method === 'PATCH')).toBe(false)

    /* The session's profile is refreshed, so the customer routes and the account
       nav become available immediately rather than after a manual reload. */
    expect(refreshProfile, 'AuthProvider profile state must be refreshed').toHaveBeenCalled()
  })

  it('never submits a role, an auth id or an email', async () => {
    const { container } = await mount()
    await type(field(container, 'Full name'), 'Amina Nakato')
    await act(async () => {
      container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    })

    const post = calls.find(c => c.method === 'POST')
    for (const forbidden of ['role', 'auth_user_id', 'authUserId', 'email', 'id']) {
      expect(post.body, `${forbidden} must never be sent from the browser`).not.toHaveProperty(forbidden)
    }
    expect(Object.keys(post.body).sort()).toEqual(['companyName', 'fullName', 'phone'])

    // The form offers no control for any of them either.
    expect(container.textContent.toLowerCase()).not.toContain('administrator')
    expect(container.querySelector('[name="role"]')).toBeNull()
  })
})

describe('editing an existing profile', () => {
  beforeEach(() => {
    nextProfile = { id: 'p1', auth_user_id: 'auth-1', role: 'customer', full_name: 'Amina Nakato', phone: '+256 700 000000', company_name: 'Nakato Ltd' }
  })

  it('renders the existing details and updates with PATCH /me', async () => {
    const { container } = await mount()

    expect(container.textContent).toContain('Your details')
    expect(container.textContent, 'an existing customer is not onboarding').not.toContain('Complete your profile')
    expect(field(container, 'Full name').value).toBe('Amina Nakato')
    expect(field(container, 'Company or organisation').value).toBe('Nakato Ltd')

    await type(field(container, 'Full name'), 'Amina N.')
    await act(async () => {
      container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    })

    const patch = calls.find(c => c.path === '/me' && c.method === 'PATCH')
    expect(patch, 'an existing profile must be updated with PATCH /me').toBeTruthy()
    expect(patch.body.fullName).toBe('Amina N.')
    expect(calls.some(c => c.method === 'POST'), 'must not re-create an existing profile').toBe(false)
  })
})
