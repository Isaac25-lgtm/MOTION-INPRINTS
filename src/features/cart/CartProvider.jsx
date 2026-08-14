import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { cartService } from '../../services/cartService'

/* Cart state (Prompt 5.4).

   The cart stores *intent* — product, quantity and option choices — and never a
   price the browser can be trusted on. Totals shown here always come back from
   `POST /api/cart/validate`, which reprices from the database. That is what makes
   editing localStorage pointless rather than merely discouraged.

   Guest carts survive navigation, refresh and browser restart via localStorage.
   Signed-in synchronisation is a later addition; nothing here prevents it. */

const STORAGE_KEY = 'motion.cart.v1'
const CartContext = createContext(null)

/* Two lines are the same only if the product AND the whole configuration match,
   so one T-shirt in two colours is two lines rather than a quantity of two. */
function lineKey(productId, selection) {
  const normalised = Object.keys(selection || {}).sort().map(key => `${key}=${selection[key]}`).join('&')
  return `${productId}::${normalised}`
}

function read() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Defensive: a hand-edited store must not be able to crash the app.
    return parsed
      .filter(line => line && typeof line.productId === 'string' && Number.isInteger(line.quantity) && line.quantity > 0)
      .slice(0, 50)
      .map(line => ({ key: line.key, productId: line.productId, quantity: line.quantity, selection: line.selection || {}, name: line.name, slug: line.slug, image: line.image ?? null }))
  } catch {
    return []
  }
}

function write(lines) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)) } catch { /* private mode, quota — the cart still works for this session */ }
}

export function CartProvider({ children }) {
  const [lines, setLines] = useState(() => (typeof window === 'undefined' ? [] : read()))
  const [validation, setValidation] = useState({ loading: false, data: null, error: null })

  useEffect(() => { if (typeof window !== 'undefined') write(lines) }, [lines])

  // Another tab is the same cart.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const onStorage = (event) => { if (event.key === STORAGE_KEY) setLines(read()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const add = useCallback((product, selection, quantity) => {
    const key = lineKey(product.id, selection)
    setLines(current => {
      const existing = current.find(line => line.key === key)
      if (existing) return current.map(line => (line.key === key ? { ...line, quantity: line.quantity + quantity } : line))
      return [...current, { key, productId: product.id, slug: product.slug, name: product.name, image: product.image ?? null, selection, quantity }]
    })
    return key
  }, [])

  const setQuantity = useCallback((key, quantity) => {
    setLines(current => (quantity < 1
      ? current.filter(line => line.key !== key)
      : current.map(line => (line.key === key ? { ...line, quantity } : line))))
  }, [])

  const remove = useCallback((key) => setLines(current => current.filter(line => line.key !== key)), [])
  const clear = useCallback(() => setLines([]), [])

  /* Revalidation is explicit rather than automatic on every change, so a customer
     adjusting a quantity does not fire a request per keystroke. Cart and checkout
     call it; the header does not need it. */
  const revalidate = useCallback(async () => {
    if (!lines.length) { setValidation({ loading: false, data: { items: [], subtotal: '0', valid: true }, error: null }); return null }
    setValidation(current => ({ ...current, loading: true, error: null }))
    try {
      const data = await cartService.validate(lines)
      setValidation({ loading: false, data, error: null })
      return data
    } catch (error) {
      setValidation({ loading: false, data: null, error })
      return null
    }
  }, [lines])

  const value = useMemo(() => ({
    lines,
    // Item count, not unit count: five of one thing is one line in the badge.
    count: lines.length,
    unitCount: lines.reduce((total, line) => total + line.quantity, 0),
    add, setQuantity, remove, clear, revalidate, validation,
  }), [lines, add, setQuantity, remove, clear, revalidate, validation])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside CartProvider')
  return context
}

export { lineKey }
