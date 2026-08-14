import { createContext, useContext, useMemo } from 'react'
import { contentService } from '../services/contentService'
import { useResource } from '../hooks/useResource'

/* Business content comes from the CMS (`content_entries`), never from constants
   in the interface. The seed ships every slot empty and unpublished, so until the
   owner fills them `get()` returns null and each section omits itself rather than
   showing invented copy, phone numbers or opening hours. */

const SiteContentContext = createContext({ get: () => null, loading: false })

export function SiteContentProvider({ children }) {
  const state = useResource(({ signal }) => contentService.public({ signal }), [])

  const value = useMemo(() => {
    const map = new Map()
    for (const row of state.data || []) map.set(`${row.section}:${row.entry_key}`, row.value)

    const get = (section, key = 'default') => {
      const entry = map.get(`${section}:${key}`)
      if (!entry || typeof entry !== 'object') return null
      return Object.keys(entry).length ? entry : null
    }
    /** Reads one field from a CMS entry, returning null when unset. */
    const field = (section, key, name) => {
      const entry = get(section, key)
      const raw = entry?.[name]
      return typeof raw === 'string' && raw.trim() ? raw.trim() : (Array.isArray(raw) && raw.length ? raw : null)
    }
    return { get, field, loading: state.loading, error: state.error }
  }, [state.data, state.loading, state.error])

  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>
}

export const useSiteContent = () => useContext(SiteContentContext)

/** Contact details, all optional. Nothing here is defaulted to a made-up value. */
export function useContactDetails() {
  const { field } = useSiteContent()
  return {
    phone: field('contact', 'details', 'phone'),
    whatsapp: field('contact', 'details', 'whatsapp'),
    email: field('contact', 'details', 'email'),
    address: field('contact', 'details', 'address'),
    mapUrl: field('contact', 'details', 'mapUrl'),
    hours: field('business_hours', 'default', 'lines'),
    social: field('social', 'accounts', 'links'),
  }
}
